/* eslint-disable max-lines -- Why: Claude rate-limit fetching needs the auth storage,
refresh-token flow, response parsing, and PTY fallback in one place so the
reliability rules stay aligned with the reference implementation. */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ProviderRateLimits, RateLimitWindow } from '../../shared/rate-limit-types'
import { fetchViaPty } from './claude-pty'

const OAUTH_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const OAUTH_REFRESH_URL = 'https://platform.claude.com/v1/oauth/token'
const OAUTH_BETA_HEADER = 'oauth-2025-04-20'
const OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const OAUTH_SCOPES =
  'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload'
const KEYCHAIN_SERVICE = 'Claude Code-credentials'
const API_TIMEOUT_MS = 10_000
const REFRESH_TIMEOUT_MS = 15_000
const REFRESH_BUFFER_MS = 5 * 60 * 1000

type ClaudeOAuthCredentials = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  scopes?: string[]
  subscriptionType?: string
}

type ClaudeCredentialDocument = {
  claudeAiOauth?: ClaudeOAuthCredentials
}

type LoadedClaudeCredentials = {
  oauth: ClaudeOAuthCredentials
  source: 'file' | 'keychain-current-user' | 'keychain-legacy'
  fullData: ClaudeCredentialDocument
}

type OAuthUsageWindow = {
  utilization?: number
  resets_at?: string
}

type OAuthUsageResponse = {
  five_hour?: OAuthUsageWindow
  seven_day?: OAuthUsageWindow
}

function decodeHexUtf8(hex: string): string | null {
  try {
    const bytes = Buffer.from(hex, 'hex')
    return bytes.toString('utf8')
  } catch {
    return null
  }
}

function tryParseCredentialJson(text: string): ClaudeCredentialDocument | null {
  try {
    return JSON.parse(text) as ClaudeCredentialDocument
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
      return JSON.parse(decoded) as ClaudeCredentialDocument
    } catch {
      return null
    }
  }
}

function getCredentialsPath(): string {
  const homeOverride = process.env.CLAUDE_CONFIG_DIR?.trim()
  if (homeOverride) {
    return path.join(homeOverride, '.credentials.json')
  }
  return path.join(homedir(), '.claude', '.credentials.json')
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

async function readFromKeychain(): Promise<LoadedClaudeCredentials | null> {
  if (process.platform !== 'darwin') {
    return null
  }

  const user = process.env.USER?.trim()
  const attempts: Array<{
    args: string[]
    source: LoadedClaudeCredentials['source']
  }> = [
    ...(user
      ? [
          {
            args: ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', user, '-w'],
            source: 'keychain-current-user' as const
          }
        ]
      : []),
    {
      args: ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
      source: 'keychain-legacy' as const
    }
  ]

  for (const attempt of attempts) {
    const raw = await readKeychainValue(attempt.args)
    if (!raw) {
      continue
    }
    const parsed = tryParseCredentialJson(raw)
    const oauth = parsed?.claudeAiOauth
    if (!oauth || (!oauth.accessToken && !oauth.refreshToken)) {
      continue
    }
    return {
      oauth,
      source: attempt.source,
      fullData: parsed ?? { claudeAiOauth: oauth }
    }
  }

  return null
}

async function readFromCredentialsFile(): Promise<LoadedClaudeCredentials | null> {
  try {
    const raw = await readFile(getCredentialsPath(), 'utf-8')
    const parsed = tryParseCredentialJson(raw)
    const oauth = parsed?.claudeAiOauth
    if (!oauth || (!oauth.accessToken && !oauth.refreshToken)) {
      return null
    }
    return {
      oauth,
      source: 'file',
      fullData: parsed ?? { claudeAiOauth: oauth }
    }
  } catch {
    return null
  }
}

async function loadClaudeCredentials(): Promise<LoadedClaudeCredentials | null> {
  const fromFile = await readFromCredentialsFile()
  if (fromFile) {
    return fromFile
  }
  return readFromKeychain()
}

function shouldRefresh(oauth: ClaudeOAuthCredentials, nowMs: number): boolean {
  if (typeof oauth.expiresAt !== 'number') {
    return false
  }
  return oauth.expiresAt - nowMs <= REFRESH_BUFFER_MS
}

async function persistClaudeCredentials(loaded: LoadedClaudeCredentials): Promise<void> {
  const nextDoc: ClaudeCredentialDocument = {
    ...loaded.fullData,
    claudeAiOauth: loaded.oauth
  }

  if (loaded.source === 'file') {
    await writeFile(getCredentialsPath(), JSON.stringify(nextDoc, null, 2), 'utf-8')
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
    JSON.stringify(nextDoc)
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

async function refreshClaudeAccessToken(loaded: LoadedClaudeCredentials): Promise<string | null> {
  const refreshToken = loaded.oauth.refreshToken?.trim()
  if (!refreshToken) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)

  try {
    const response = await fetch(OAUTH_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: OAUTH_CLIENT_ID,
        scope: OAUTH_SCOPES
      }),
      signal: controller.signal
    })

    if (response.status === 400 || response.status === 401) {
      throw new Error('Token expired. Run `claude` to log in again.')
    }
    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }
    if (!payload.access_token) {
      return null
    }

    loaded.oauth = {
      ...loaded.oauth,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? loaded.oauth.refreshToken,
      expiresAt:
        typeof payload.expires_in === 'number'
          ? Date.now() + payload.expires_in * 1000
          : loaded.oauth.expiresAt
    }
    await persistClaudeCredentials(loaded)
    return payload.access_token
  } finally {
    clearTimeout(timeout)
  }
}

async function requestClaudeUsage(accessToken: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    return await fetch(OAUTH_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': OAUTH_BETA_HEADER,
        'User-Agent': 'claude-code/2.1.69'
      },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

function parseResetDescription(isoString: string | undefined): string | null {
  if (!isoString) {
    return null
  }
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function mapWindow(raw: OAuthUsageWindow | undefined, windowMinutes: number): RateLimitWindow | null {
  if (!raw || typeof raw.utilization !== 'number') {
    return null
  }

  const resetsAt =
    typeof raw.resets_at === 'string' && !Number.isNaN(new Date(raw.resets_at).getTime())
      ? new Date(raw.resets_at).getTime()
      : null

  return {
    usedPercent: Math.min(100, Math.max(0, raw.utilization)),
    windowMinutes,
    resetsAt,
    resetDescription: parseResetDescription(raw.resets_at)
  }
}

async function fetchViaOAuth(loaded: LoadedClaudeCredentials): Promise<ProviderRateLimits> {
  let accessToken = loaded.oauth.accessToken?.trim() ?? ''
  if (!accessToken) {
    const refreshed = await refreshClaudeAccessToken(loaded)
    if (!refreshed) {
      throw new Error('Token expired. Run `claude` to log in again.')
    }
    accessToken = refreshed
  } else if (shouldRefresh(loaded.oauth, Date.now())) {
    const refreshed = await refreshClaudeAccessToken(loaded)
    if (refreshed) {
      accessToken = refreshed
    }
  }

  let response = await requestClaudeUsage(accessToken)
  if (response.status === 400 || response.status === 401) {
    const refreshed = await refreshClaudeAccessToken(loaded)
    if (refreshed) {
      response = await requestClaudeUsage(refreshed)
    }
  }

  if (response.status === 400 || response.status === 401) {
    throw new Error('Token expired. Run `claude` to log in again.')
  }
  if (!response.ok) {
    throw new Error(`Usage request failed (HTTP ${response.status}). Try again later.`)
  }

  const data = (await response.json()) as OAuthUsageResponse
  return {
    provider: 'claude',
    session: mapWindow(data.five_hour, 300),
    weekly: mapWindow(data.seven_day, 10080),
    updatedAt: Date.now(),
    error: null,
    status: 'ok'
  }
}

function errorState(message: string): ProviderRateLimits {
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: message,
    status: 'error'
  }
}

export async function fetchClaudeRateLimits(): Promise<ProviderRateLimits> {
  const credentials = await loadClaudeCredentials()

  if (credentials) {
    try {
      return await fetchViaOAuth(credentials)
    } catch (oauthError) {
      try {
        return await fetchViaPty()
      } catch {
        return errorState(
          oauthError instanceof Error ? oauthError.message : 'Claude usage is unavailable right now.'
        )
      }
    }
  }

  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: 'No Claude OAuth session found.',
    status: 'unavailable'
  }
}
