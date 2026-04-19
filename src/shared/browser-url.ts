import { ORCA_BROWSER_BLANK_URL } from './constants'

const LOCAL_ADDRESS_PATTERN =
  /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[[0-9a-f:]+\])(?::\d+)?(?:\/.*)?$/i
const EXPLICIT_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const GOOGLE_SEARCH_BASE_URL = 'https://www.google.com/search?q='
const UNDUCK_BANG_BASE_URL = 'https://unduck.link?q='
const ADDRESS_BAR_BANG_PATTERN = /^![^\s]+(?:\s+.*)?$/u

export function normalizeBrowserNavigationUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (trimmed.length === 0 || trimmed === 'about:blank' || trimmed === ORCA_BROWSER_BLANK_URL) {
    return ORCA_BROWSER_BLANK_URL
  }

  if (LOCAL_ADDRESS_PATTERN.test(trimmed)) {
    try {
      return new URL(`http://${trimmed}`).toString()
    } catch {
      return null
    }
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString()
    } catch {
      return null
    }
  }
}

export function normalizeExternalBrowserUrl(rawUrl: string): string | null {
  const normalized = normalizeBrowserNavigationUrl(rawUrl)
  return normalized === ORCA_BROWSER_BLANK_URL ? null : normalized
}

function hasNavigableHostname(rawInput: string): boolean {
  if (rawInput.length === 0 || /\s/.test(rawInput)) {
    return false
  }

  try {
    const candidate = new URL(`https://${rawInput}`)
    return candidate.hostname.includes('.')
  } catch {
    return false
  }
}

export function resolveBrowserAddressBarUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim()
  if (trimmed.length === 0 || trimmed === 'about:blank' || trimmed === ORCA_BROWSER_BLANK_URL) {
    return ORCA_BROWSER_BLANK_URL
  }

  if (ADDRESS_BAR_BANG_PATTERN.test(trimmed)) {
    // Why: `!bang` shortcuts are intended as an omnibox power-user feature.
    // Forward the raw query to Unduck so Orca gets DuckDuckGo-compatible bangs
    // without embedding and maintaining the full redirect catalog locally.
    return `${UNDUCK_BANG_BASE_URL}${encodeURIComponent(trimmed)}`
  }

  if (LOCAL_ADDRESS_PATTERN.test(trimmed) || EXPLICIT_SCHEME_PATTERN.test(trimmed)) {
    return normalizeBrowserNavigationUrl(trimmed)
  }

  if (hasNavigableHostname(trimmed)) {
    return normalizeBrowserNavigationUrl(trimmed)
  }

  // Why: browser address bars treat bare words like "facebook" as search
  // queries, not synthetic hosts like https://facebook/. Only inputs that
  // already look like navigable destinations should be promoted to URLs.
  return `${GOOGLE_SEARCH_BASE_URL}${encodeURIComponent(trimmed)}`
}
