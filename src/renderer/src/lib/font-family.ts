const GENERIC_FONT_KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont'
])

const APP_FONT_FALLBACKS = ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']

const MONOSPACE_FONT_FALLBACKS = [
  'SF Mono',
  'SFMono-Regular',
  'ui-monospace',
  'Monaco',
  'Cascadia Mono',
  'Cascadia Code',
  'Menlo',
  'Consolas',
  'DejaVu Sans Mono',
  'Liberation Mono',
  'monospace'
]

function normalizeFontToken(token: string): string {
  return token.trim().replace(/^['"]+|['"]+$/g, '').toLowerCase()
}

function formatFontToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) {
    return ''
  }

  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, '')
  if (GENERIC_FONT_KEYWORDS.has(unquoted.toLowerCase())) {
    return unquoted
  }

  return `"${unquoted}"`
}

function buildFontStack(fontFamily: string, fallbacks: readonly string[]): string {
  const userTokens = fontFamily
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
  const parts = userTokens.map(formatFontToken).filter(Boolean)
  const normalizedUserTokens = userTokens.map(normalizeFontToken)
  const seen = new Set(normalizedUserTokens)

  for (const fallback of fallbacks) {
    const normalizedFallback = normalizeFontToken(fallback)
    if (
      seen.has(normalizedFallback) ||
      normalizedUserTokens.some((token) => token.includes(normalizedFallback))
    ) {
      continue
    }
    parts.push(formatFontToken(fallback))
    seen.add(normalizedFallback)
  }

  return parts.join(', ')
}

export function buildAppFontFamily(fontFamily: string): string {
  return buildFontStack(fontFamily, APP_FONT_FALLBACKS)
}

export function buildCodeFontFamily(fontFamily: string): string {
  return buildFontStack(fontFamily, MONOSPACE_FONT_FALLBACKS)
}
