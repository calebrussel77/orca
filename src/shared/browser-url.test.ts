import { describe, expect, it } from 'vitest'
import { ORCA_BROWSER_BLANK_URL } from './constants'
import {
  normalizeBrowserNavigationUrl,
  normalizeExternalBrowserUrl,
  resolveBrowserAddressBarUrl
} from './browser-url'

describe('browser-url helpers', () => {
  it('normalizes manual local-dev inputs to http', () => {
    expect(normalizeBrowserNavigationUrl('localhost:3000')).toBe('http://localhost:3000/')
    expect(normalizeBrowserNavigationUrl('127.0.0.1:5173')).toBe('http://127.0.0.1:5173/')
  })

  it('keeps normal web URLs and blank tabs in the allowed set', () => {
    expect(normalizeBrowserNavigationUrl('https://example.com')).toBe('https://example.com/')
    expect(normalizeBrowserNavigationUrl('')).toBe(ORCA_BROWSER_BLANK_URL)
    expect(normalizeBrowserNavigationUrl('about:blank')).toBe(ORCA_BROWSER_BLANK_URL)
  })

  it('rejects non-web schemes for in-app navigation', () => {
    expect(normalizeBrowserNavigationUrl('file:///etc/passwd')).toBeNull()
    expect(normalizeBrowserNavigationUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeExternalBrowserUrl('about:blank')).toBeNull()
  })

  it('treats bare words in the address bar as Google searches', () => {
    expect(resolveBrowserAddressBarUrl('facebook')).toBe('https://www.google.com/search?q=facebook')
    expect(resolveBrowserAddressBarUrl('  hello world  ')).toBe(
      'https://www.google.com/search?q=hello%20world'
    )
  })

  it('keeps direct destinations navigable from the address bar', () => {
    expect(resolveBrowserAddressBarUrl('facebook.com')).toBe('https://facebook.com/')
    expect(resolveBrowserAddressBarUrl('localhost:3000')).toBe('http://localhost:3000/')
    expect(resolveBrowserAddressBarUrl('https://example.com/docs')).toBe(
      'https://example.com/docs'
    )
  })

  it('still rejects unsupported explicit schemes in the address bar', () => {
    expect(resolveBrowserAddressBarUrl('javascript:alert(1)')).toBeNull()
    expect(resolveBrowserAddressBarUrl('file:///etc/passwd')).toBeNull()
  })
})
