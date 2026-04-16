import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { readFileMock, writeFileMock, execFileMock, fetchViaPtyMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  execFileMock: vi.fn(),
  fetchViaPtyMock: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  writeFile: writeFileMock
}))

vi.mock('node:child_process', () => ({
  execFile: execFileMock
}))

vi.mock('./claude-pty', () => ({
  fetchViaPty: fetchViaPtyMock
}))

import { fetchClaudeRateLimits } from './claude-fetcher'

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response
}

describe('fetchClaudeRateLimits', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    fetchViaPtyMock.mockResolvedValue({
      provider: 'claude',
      session: null,
      weekly: null,
      updatedAt: Date.now(),
      error: 'pty fallback',
      status: 'error'
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('refreshes expired credentials from file before querying usage', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        claudeAiOauth: {
          accessToken: 'old-access',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() - 1_000
        }
      })
    )

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          five_hour: { utilization: 81, resets_at: '2026-04-16T12:00:00.000Z' },
          seven_day: { utilization: 98, resets_at: '2026-04-18T12:00:00.000Z' }
        })
      )
    global.fetch = fetchMock

    const result = await fetchClaudeRateLimits()

    expect(result.status).toBe('ok')
    expect(result.session?.usedPercent).toBe(81)
    expect(result.weekly?.usedPercent).toBe(98)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(String(writeFileMock.mock.calls[0]?.[1])).toContain('new-access')
    expect(fetchViaPtyMock).not.toHaveBeenCalled()
  })

  it('accepts hex-encoded credentials files', async () => {
    const hex = Buffer.from(
      JSON.stringify({
        claudeAiOauth: {
          accessToken: 'hex-access',
          refreshToken: 'hex-refresh',
          expiresAt: Date.now() + 10 * 60_000
        }
      }),
      'utf8'
    ).toString('hex')

    readFileMock.mockResolvedValue(hex)
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(200, {
        five_hour: { utilization: 40, resets_at: '2026-04-16T12:00:00.000Z' },
        seven_day: { utilization: 55, resets_at: '2026-04-18T12:00:00.000Z' }
      })
    )

    const result = await fetchClaudeRateLimits()

    expect(result.status).toBe('ok')
    expect(result.session?.usedPercent).toBe(40)
    expect(result.weekly?.usedPercent).toBe(55)
    expect(fetchViaPtyMock).not.toHaveBeenCalled()
  })
})
