import { existsSync } from 'fs'
import { win32 } from 'path'

export const WINDOWS_POWERSHELL_7 = 'pwsh.exe'
export const WINDOWS_POWERSHELL_LEGACY = 'powershell.exe'

function getWindowsEnvValue(env: NodeJS.ProcessEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]
    if (value) {
      return value
    }
  }
  return undefined
}

function getWindowsBasename(shellPath: string): string {
  return win32.basename(shellPath).toLowerCase()
}

export function isWindowsPowerShellShell(shellPath: string | undefined): boolean {
  if (!shellPath) {
    return false
  }
  const shellName = getWindowsBasename(shellPath)
  return shellName === WINDOWS_POWERSHELL_7 || shellName === WINDOWS_POWERSHELL_LEGACY
}

export function findPowerShell7Executable(env: NodeJS.ProcessEnv = process.env): string | null {
  const pathValue = getWindowsEnvValue(env, ['PATH', 'Path', 'path']) ?? ''
  const candidates = pathValue
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => win32.isAbsolute(segment))
    .map((segment) => win32.join(segment, WINDOWS_POWERSHELL_7))

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function resolvePreferredWindowsPowerShell(
  fallbackShell = WINDOWS_POWERSHELL_LEGACY,
  env: NodeJS.ProcessEnv = process.env
): string {
  // Why: Orca's "PowerShell" UI entry should launch PowerShell 7 when the user
  // has it installed, but still fall back to Windows PowerShell on machines
  // where only the inbox shell exists.
  return findPowerShell7Executable(env) ?? fallbackShell
}

export function resolveWindowsShellChoice(
  shellPath: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!shellPath) {
    const comspec = getWindowsEnvValue(env, ['COMSPEC', 'ComSpec'])
    const fallbackShell = isWindowsPowerShellShell(comspec) ? comspec : WINDOWS_POWERSHELL_LEGACY
    return resolvePreferredWindowsPowerShell(fallbackShell, env)
  }
  if (isWindowsPowerShellShell(shellPath)) {
    return resolvePreferredWindowsPowerShell(shellPath, env)
  }
  return shellPath
}
