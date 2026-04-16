import { describe, expect, it } from 'vitest'
import { detectLanguage } from './language-detect'

describe('detectLanguage', () => {
  it('maps tsx files to the Monaco typescript language id', () => {
    expect(detectLanguage('src/components/college-card.tsx')).toBe('typescript')
  })

  it('maps jsx files to the Monaco javascript language id', () => {
    expect(detectLanguage('src/components/widget.jsx')).toBe('javascript')
  })
})
