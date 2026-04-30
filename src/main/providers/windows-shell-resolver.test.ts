import { describe, expect, it, vi } from 'vitest'

const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn()
}))

vi.mock('fs', () => ({
  existsSync: existsSyncMock
}))

import {
  findPowerShell7Executable,
  resolveWindowsShellChoice,
  WINDOWS_POWERSHELL_LEGACY
} from './windows-shell-resolver'

describe('windows-shell-resolver', () => {
  it('finds pwsh.exe on the Windows PATH', () => {
    existsSyncMock.mockImplementation(
      (targetPath: string) => targetPath === 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    )

    expect(
      findPowerShell7Executable({
        PATH: 'C:\\Program Files\\PowerShell\\7;C:\\Windows\\System32'
      })
    ).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe')
  })

  it('does not treat relative PATH entries as a resolved PowerShell 7 install', () => {
    existsSyncMock.mockReturnValue(true)

    expect(
      findPowerShell7Executable({
        PATH: './node_modules/.bin'
      })
    ).toBeNull()
  })

  it('resolves legacy powershell.exe to PowerShell 7 when available', () => {
    existsSyncMock.mockImplementation(
      (targetPath: string) => targetPath === 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    )

    expect(
      resolveWindowsShellChoice(WINDOWS_POWERSHELL_LEGACY, {
        PATH: 'C:\\Program Files\\PowerShell\\7'
      })
    ).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe')
  })
})
