import { describe, expect, it, vi } from 'vitest'
import { syncMonacoModelLanguage } from './monaco-language'

describe('syncMonacoModelLanguage', () => {
  it('does nothing when the editor has no model', () => {
    const setModelLanguage = vi.fn()

    syncMonacoModelLanguage(
      { getModel: () => null },
      { editor: { setModelLanguage } },
      'typescriptreact'
    )

    expect(setModelLanguage).not.toHaveBeenCalled()
  })

  it('does nothing when the model already has the requested language', () => {
    const setModelLanguage = vi.fn()
    const model = { getLanguageId: () => 'typescriptreact' }

    syncMonacoModelLanguage(
      { getModel: () => model },
      { editor: { setModelLanguage } },
      'typescriptreact'
    )

    expect(setModelLanguage).not.toHaveBeenCalled()
  })

  it('retags kept models when the detected language changes', () => {
    const setModelLanguage = vi.fn()
    const model = { getLanguageId: () => 'plaintext' }

    syncMonacoModelLanguage(
      { getModel: () => model },
      { editor: { setModelLanguage } },
      'typescriptreact'
    )

    expect(setModelLanguage).toHaveBeenCalledWith(model, 'typescriptreact')
  })
})
