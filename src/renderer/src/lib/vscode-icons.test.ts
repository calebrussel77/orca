import { describe, expect, it } from 'vitest'
import { basenameOfPath, getVscodeIconUrlForEntry } from './vscode-icons'

describe('basenameOfPath', () => {
  it('supports POSIX and Windows separators', () => {
    expect(basenameOfPath('packages/src')).toBe('src')
    expect(basenameOfPath('packages\\src')).toBe('src')
  })
})

describe('getVscodeIconUrlForEntry', () => {
  it('uses exact filename matches from the vscode-icons manifest', () => {
    const iconUrl = getVscodeIconUrlForEntry('tsconfig.tsbuildinfo', 'file', 'dark')
    expect(iconUrl.endsWith('/file_type_tsbuildinfo.svg')).toBe(true)
  })

  it('uses folder mappings and light-aware filename mappings', () => {
    const folderUrl = getVscodeIconUrlForEntry('packages/src', 'directory', 'light')
    expect(folderUrl.endsWith('/folder_type_src.svg')).toBe(true)
  })

  it('falls back to default icons for unknown entries', () => {
    const folderUrl = getVscodeIconUrlForEntry('totally-unknown-folder', 'directory', 'dark')
    const fileUrl = getVscodeIconUrlForEntry('totally-unknown-file.zzz', 'file', 'dark')
    expect(folderUrl.endsWith('/default_folder.svg')).toBe(true)
    expect(fileUrl.endsWith('/default_file.svg')).toBe(true)
  })
})
