import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { readFileMock, writeFileMock, execFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  execFileMock: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  writeFile: writeFileMock
}))

vi.mock('node:child_process', () => ({
  execFile: execFileMock
}))

import { fetchCodexRateLimits } from './codex-fetcher'

function jsonResponse(status: number, payload: unknown, headers?: HeadersInit): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue(JSON.stringify(payload))
  } as unknown as Response
}

describe('fetchCodexRateLimits', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('refreshes stale auth before querying usage', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        tokens: {
          access_token: 'old-access',
          refresh_token: 'refresh-token',
          account_id: 'acct-123'
        },
        last_refresh: '2024-01-01T00:00:00.000Z'
      })
    )

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          id_token: 'new-id'
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          {
            rate_limit: {
              primary_window: { reset_after_seconds: 3600 },
              secondary_window: { reset_after_seconds: 7200 }
            }
          },
          {
            'x-codex-primary-used-percent': '81',
            'x-codex-secondary-used-percent': '98'
          }
        )
      )
    global.fetch = fetchMock

    const result = await fetchCodexRateLimits({ codexHomePath: '/tmp/codex-home' })

    expect(result.status).toBe('ok')
    expect(result.session?.usedPercent).toBe(81)
    expect(result.weekly?.usedPercent).toBe(98)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(String(writeFileMock.mock.calls[0]?.[1])).toContain('new-access')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://chatgpt.com/backend-api/wham/usage')
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer new-access',
      'ChatGPT-Account-Id': 'acct-123'
    })
  })

  it('accepts hex-encoded auth files and falls back to payload percentages', async () => {
    const hex = Buffer.from(
      JSON.stringify({
        tokens: {
          access_token: 'live-access',
          refresh_token: 'refresh-token'
        },
        last_refresh: new Date().toISOString()
      }),
      'utf8'
    ).toString('hex')

    readFileMock.mockResolvedValue(hex)
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(200, {
        rate_limit: {
          primary_window: { used_percent: 33, reset_after_seconds: 3600 },
          secondary_window: { used_percent: 44, reset_after_seconds: 7200 }
        }
      })
    )

    const result = await fetchCodexRateLimits({ codexHomePath: '/tmp/codex-home' })

    expect(result.status).toBe('ok')
    expect(result.session?.usedPercent).toBe(33)
    expect(result.weekly?.usedPercent).toBe(44)
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('keeps header-based limits when the response body has trailing junk', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        tokens: {
          access_token: 'live-access',
          refresh_token: 'refresh-token'
        },
        last_refresh: new Date().toISOString()
      })
    )

    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'x-codex-primary-used-percent': '9',
        'x-codex-secondary-used-percent': '0'
      }),
      json: vi.fn(),
      text: vi
        .fn()
        .mockResolvedValue(
          `${JSON.stringify({ rate_limit: { primary_window: { reset_after_seconds: 11349 } } })}\nTRAILING`
        )
    } as unknown as Response)

    const result = await fetchCodexRateLimits({ codexHomePath: '/tmp/codex-home' })

    expect(result.status).toBe('ok')
    expect(result.session?.usedPercent).toBe(9)
    expect(result.weekly?.usedPercent).toBe(0)
  })
})
