/* eslint-disable max-lines -- Why: Codex rate-limit fetching needs auth discovery,
token refresh, response parsing, and CLI fallback together so account-scoped
quota reads stay consistent with the reference implementation. */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ProviderRateLimits, RateLimitWindow } from '../../shared/rate-limit-types'
import { resolveCodexCommand } from '../codex-cli/command'

const AUTH_FILE = 'auth.json'
const KEYCHAIN_SERVICE = 'Codex Auth'
const DEFAULT_AUTH_DIRS = ['.config/codex', '.codex']
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const REFRESH_URL = 'https://auth.openai.com/oauth/token'
const USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const API_TIMEOUT_MS = 10_000
const REFRESH_TIMEOUT_MS = 15_000
const REFRESH_AGE_MS = 8 * 24 * 60 * 60 * 1000
const PTY_TIMEOUT_MS = 15_000

export type FetchCodexRateLimitsOptions = {
  codexHomePath?: string | null
}

type CodexAuthPayload = {
  tokens?: {
    access_token?: string
    refresh_token?: string
    id_token?: string
    account_id?: string
  }
  last_refresh?: string
  OPENAI_API_KEY?: string
}

type LoadedCodexAuth = {
  auth: CodexAuthPayload
  source: 'file' | 'keychain'
  authPath: string | null
}

type CodexUsageWindow = {
  used_percent?: number
  reset_at?: number
  reset_after_seconds?: number
}

type CodexUsageResponse = {
  rate_limit?: {
    primary_window?: CodexUsageWindow
    secondary_window?: CodexUsageWindow
  }
}

function tryParseJsonObject<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const start = text.indexOf('{')
    if (start === -1) {
      return null
    }

    let depth = 0
    let inString = false
    let escaped = false

    for (let i = start; i < text.length; i++) {
      const char = text[i]

      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }
      if (char === '{') {
        depth += 1
        continue
      }
      if (char !== '}') {
        continue
      }

      depth -= 1
      if (depth !== 0) {
        continue
      }

      try {
        return JSON.parse(text.slice(start, i + 1)) as T
      } catch {
        return null
      }
    }

    return null
  }
}

function decodeHexUtf8(hex: string): string | null {
  try {
    return Buffer.from(hex, 'hex').toString('utf8')
  } catch {
    return null
  }
}

function tryParseAuthJson(text: string): CodexAuthPayload | null {
  try {
    return JSON.parse(text) as CodexAuthPayload
  } catch {
    const trimmed = text.trim().replace(/^0x/i, '')
    if (!trimmed || trimmed.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(trimmed)) {
      return null
    }
    const decoded = decodeHexUtf8(trimmed)
    if (!decoded) {
      return null
    }
    try {
      return JSON.parse(decoded) as CodexAuthPayload
    } catch {
      return null
    }
  }
}

function hasTokenLikeAuth(auth: CodexAuthPayload | null | undefined): auth is CodexAuthPayload {
  if (!auth) {
    return false
  }
  return Boolean(auth.tokens?.access_token || auth.tokens?.refresh_token || auth.OPENAI_API_KEY)
}

function resolveAuthPaths(options?: FetchCodexRateLimitsOptions): string[] {
  const codexHome = options?.codexHomePath?.trim()
  if (codexHome) {
    return [path.join(codexHome, AUTH_FILE)]
  }
  return DEFAULT_AUTH_DIRS.map((relativeDir) => path.join(homedir(), relativeDir, AUTH_FILE))
}

function readKeychainValue(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('security', args, { timeout: 3_000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null)
        return
      }
      resolve(stdout.trim())
    })
  })
}

async function loadAuthFromKeychain(): Promise<LoadedCodexAuth | null> {
  if (process.platform !== 'darwin') {
    return null
  }

  const user = process.env.USER?.trim()
  const attempts = [
    ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
    ...(user ? [['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', user, '-w']] : [])
  ]

  for (const args of attempts) {
    const raw = await readKeychainValue(args)
    if (!raw) {
      continue
    }
    const auth = tryParseAuthJson(raw)
    if (!hasTokenLikeAuth(auth)) {
      continue
    }
    return {
      auth,
      source: 'keychain',
      authPath: null
    }
  }

  return null
}

async function loadCodexAuth(options?: FetchCodexRateLimitsOptions): Promise<LoadedCodexAuth | null> {
  for (const authPath of resolveAuthPaths(options)) {
    try {
      const raw = await readFile(authPath, 'utf-8')
      const auth = tryParseAuthJson(raw)
      if (!hasTokenLikeAuth(auth)) {
        continue
      }
      return {
        auth,
        source: 'file',
        authPath
      }
    } catch {
      // try next path
    }
  }

  return loadAuthFromKeychain()
}

async function persistCodexAuth(authState: LoadedCodexAuth): Promise<void> {
  if (authState.source === 'file' && authState.authPath) {
    await writeFile(authState.authPath, JSON.stringify(authState.auth, null, 2), 'utf-8')
    return
  }

  if (process.platform !== 'darwin') {
    return
  }

  const user = process.env.USER?.trim()
  const args = [
    'add-generic-password',
    '-U',
    '-s',
    KEYCHAIN_SERVICE,
    ...(user ? ['-a', user] : []),
    '-w',
    JSON.stringify(authState.auth)
  ]

  await new Promise<void>((resolve, reject) => {
    execFile('security', args, { timeout: 5_000 }, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function shouldRefresh(auth: CodexAuthPayload, nowMs: number): boolean {
  if (!auth.last_refresh) {
    return true
  }
  const parsed = Date.parse(auth.last_refresh)
  if (!Number.isFinite(parsed)) {
    return true
  }
  return nowMs - parsed > REFRESH_AGE_MS
}

async function refreshCodexAccessToken(authState: LoadedCodexAuth): Promise<string | null> {
  const refreshToken = authState.auth.tokens?.refresh_token?.trim()
  if (!refreshToken) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)

  try {
    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'grant_type=refresh_token' +
        `&client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&refresh_token=${encodeURIComponent(refreshToken)}`,
      signal: controller.signal
    })

    if (response.status === 400 || response.status === 401) {
      throw new Error('Token expired. Run `codex` to log in again.')
    }
    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      id_token?: string
    }
    if (!payload.access_token) {
      return null
    }

    authState.auth = {
      ...authState.auth,
      tokens: {
        ...authState.auth.tokens,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token ?? authState.auth.tokens?.refresh_token,
        id_token: payload.id_token ?? authState.auth.tokens?.id_token
      },
      last_refresh: new Date().toISOString()
    }
    await persistCodexAuth(authState)
    return payload.access_token
  } finally {
    clearTimeout(timeout)
  }
}

async function requestCodexUsage(
  accessToken: string,
  accountId: string | undefined
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    return await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'OpenUsage',
        ...(accountId ? { 'ChatGPT-Account-Id': accountId } : {})
      },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readCodexUsageBody(response: Response): Promise<CodexUsageResponse | null> {
  try {
    const text = await response.text()
    return tryParseJsonObject<CodexUsageResponse>(text)
  } catch {
    return null
  }
}

function parseHeaderPercent(response: Response, name: string): number | null {
  const value = response.headers.get(name)
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toResetsAtMs(nowSec: number, window: CodexUsageWindow | undefined): number | null {
  if (!window) {
    return null
  }
  if (typeof window.reset_at === 'number') {
    return window.reset_at * 1000
  }
  if (typeof window.reset_after_seconds === 'number') {
    return (nowSec + window.reset_after_seconds) * 1000
  }
  return null
}

function toResetDescription(resetsAt: number | null): string | null {
  if (!resetsAt) {
    return null
  }
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  return isToday
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      })
}

function mapWindow(
  usedPercent: number | null,
  windowMinutes: number,
  resetsAt: number | null
): RateLimitWindow | null {
  if (usedPercent === null) {
    return null
  }
  return {
    usedPercent: Math.min(100, Math.max(0, usedPercent)),
    windowMinutes,
    resetsAt,
    resetDescription: toResetDescription(resetsAt)
  }
}

async function fetchViaApi(
  authState: LoadedCodexAuth,
  options?: FetchCodexRateLimitsOptions
): Promise<ProviderRateLimits> {
  let accessToken = authState.auth.tokens?.access_token?.trim() ?? ''
  if (!accessToken) {
    const refreshed = await refreshCodexAccessToken(authState)
    if (!refreshed) {
      throw new Error('Token expired. Run `codex` to log in again.')
    }
    accessToken = refreshed
  } else if (shouldRefresh(authState.auth, Date.now())) {
    const refreshed = await refreshCodexAccessToken(authState)
    if (refreshed) {
      accessToken = refreshed
    }
  }

  const accountId = authState.auth.tokens?.account_id
  let response = await requestCodexUsage(accessToken, accountId)
  if (response.status === 400 || response.status === 401) {
    const refreshed = await refreshCodexAccessToken(authState)
    if (refreshed) {
      response = await requestCodexUsage(refreshed, accountId)
    }
  }

  if (response.status === 400 || response.status === 401) {
    throw new Error('Token expired. Run `codex` to log in again.')
  }
  if (!response.ok) {
    throw new Error(`Usage request failed (HTTP ${response.status}). Try again later.`)
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const data = await readCodexUsageBody(response)
  const primaryWindow = data?.rate_limit?.primary_window
  const secondaryWindow = data?.rate_limit?.secondary_window

  const session = mapWindow(
    parseHeaderPercent(response, 'x-codex-primary-used-percent') ??
      (typeof primaryWindow?.used_percent === 'number' ? primaryWindow.used_percent : null),
    300,
    toResetsAtMs(nowSec, primaryWindow)
  )
  const weekly = mapWindow(
    parseHeaderPercent(response, 'x-codex-secondary-used-percent') ??
      (typeof secondaryWindow?.used_percent === 'number' ? secondaryWindow.used_percent : null),
    10080,
    toResetsAtMs(nowSec, secondaryWindow)
  )

  return {
    provider: 'codex',
    session,
    weekly,
    updatedAt: Date.now(),
    error: null,
    status: session || weekly ? 'ok' : 'error'
  }
}

// Why: these patterns match the Codex CLI's /status output format.
const FIVE_HOUR_RE = /5h\s+limit[:\s]*(\d+)%/i
const WEEKLY_RE = /weekly\s+limit[:\s]*(\d+)%/i
const RESET_TEXT_RE = /resets?\s+(?:at\s+|in\s+)?(.+)/i

function parsePtyStatus(output: string): {
  session: RateLimitWindow | null
  weekly: RateLimitWindow | null
} {
  const fiveMatch = FIVE_HOUR_RE.exec(output)
  const weeklyMatch = WEEKLY_RE.exec(output)

  const session: RateLimitWindow | null = fiveMatch
    ? {
        usedPercent: Math.min(100, parseInt(fiveMatch[1], 10)),
        windowMinutes: 300,
        resetsAt: null,
        resetDescription: null
      }
    : null

  const weekly: RateLimitWindow | null = weeklyMatch
    ? {
        usedPercent: Math.min(100, parseInt(weeklyMatch[1], 10)),
        windowMinutes: 10080,
        resetsAt: null,
        resetDescription: null
      }
    : null

  const resetMatch = RESET_TEXT_RE.exec(output)
  if (resetMatch && session) {
    session.resetDescription = resetMatch[1].trim()
  }

  return { session, weekly }
}

async function fetchViaPty(options?: FetchCodexRateLimitsOptions): Promise<ProviderRateLimits> {
  const pty = await import('node-pty')
  const codexCommand = resolveCodexCommand()
  const isWindowsBatchScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(codexCommand)
  const spawnFile = isWindowsBatchScript ? 'cmd.exe' : codexCommand
  const spawnArgs = isWindowsBatchScript ? ['/c', codexCommand] : []

  return new Promise<ProviderRateLimits>((resolve) => {
    let output = ''
    let resolved = false
    let sentStatus = false

    const term = pty.spawn(spawnFile, spawnArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        ...(options?.codexHomePath ? { CODEX_HOME: options.codexHomePath } : {})
      }
    })

    const timeout = setTimeout(() => {
      if (resolved) {
        return
      }
      resolved = true
      term.kill()
      resolve({
        provider: 'codex',
        session: null,
        weekly: null,
        updatedAt: Date.now(),
        error: 'PTY timeout',
        status: 'error'
      })
    }, PTY_TIMEOUT_MS)

    term.onData((data) => {
      output += data

      if (!sentStatus && />\s*$/.test(data)) {
        sentStatus = true
        term.write('/status\r')
        return
      }

      if (sentStatus && (FIVE_HOUR_RE.test(output) || WEEKLY_RE.test(output))) {
        setTimeout(() => {
          if (resolved) {
            return
          }
          resolved = true
          clearTimeout(timeout)
          term.kill()
          // eslint-disable-next-line no-control-regex
          const clean = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
          const { session, weekly } = parsePtyStatus(clean)
          resolve({
            provider: 'codex',
            session,
            weekly,
            updatedAt: Date.now(),
            error: session || weekly ? null : 'Failed to parse CLI output',
            status: session || weekly ? 'ok' : 'error'
          })
        }, 500)
      }
    })

    term.onExit(() => {
      if (resolved) {
        return
      }
      resolved = true
      clearTimeout(timeout)
      // eslint-disable-next-line no-control-regex
      const clean = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      const { session, weekly } = parsePtyStatus(clean)
      resolve({
        provider: 'codex',
        session,
        weekly,
        updatedAt: Date.now(),
        error: session || weekly ? null : 'CLI exited before status was available',
        status: session || weekly ? 'ok' : 'error'
      })
    })
  })
}

function errorState(message: string): ProviderRateLimits {
  return {
    provider: 'codex',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: message,
    status: 'error'
  }
}

export async function fetchCodexRateLimits(
  options?: FetchCodexRateLimitsOptions
): Promise<ProviderRateLimits> {
  const authState = await loadCodexAuth(options)

  if (authState?.auth.OPENAI_API_KEY) {
    return {
      provider: 'codex',
      session: null,
      weekly: null,
      updatedAt: Date.now(),
      error: 'Usage not available for API key.',
      status: 'unavailable'
    }
  }

  if (authState?.auth.tokens?.access_token || authState?.auth.tokens?.refresh_token) {
    try {
      return await fetchViaApi(authState, options)
    } catch (apiError) {
      try {
        return await fetchViaPty(options)
      } catch {
        return errorState(
          apiError instanceof Error ? apiError.message : 'Codex usage is unavailable right now.'
        )
      }
    }
  }

  try {
    return await fetchViaPty(options)
  } catch {
    return {
      provider: 'codex',
      session: null,
      weekly: null,
      updatedAt: Date.now(),
      error: 'No Codex session found.',
      status: 'unavailable'
    }
  }
}
