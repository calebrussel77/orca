import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const mockPaths = vi.hoisted(() => ({
  userData: '',
  home: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') {
        return mockPaths.userData
      }
      return ''
    })
  }
}))

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')
  return {
    ...actual,
    homedir: () => mockPaths.home
  }
})

import { piTitlebarExtensionService } from './titlebar-extension-service'

describe('PiTitlebarExtensionService', () => {
  let tempRoot: string

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'orca-pi-overlay-'))
    mockPaths.userData = join(tempRoot, 'userData')
    mockPaths.home = join(tempRoot, 'home')

    mkdirSync(join(mockPaths.userData), { recursive: true })
    mkdirSync(join(mockPaths.home, '.pi', 'agent', 'skills'), { recursive: true })
    mkdirSync(join(mockPaths.home, '.pi', 'agent', 'extensions'), { recursive: true })
    writeFileSync(join(mockPaths.home, '.pi', 'agent', 'settings.json'), '{"ok":true}')
    writeFileSync(join(mockPaths.home, '.pi', 'agent', 'extensions', 'custom.ts'), 'export {}')
  })

  afterEach(() => {
    piTitlebarExtensionService.clearPty('1')
    rmSync(tempRoot, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('uses a process-scoped overlay path and rebuilds it idempotently', () => {
    const firstEnv = piTitlebarExtensionService.buildPtyEnv('1', undefined)
    const overlayDir = firstEnv.PI_CODING_AGENT_DIR

    expect(overlayDir).toContain(`${process.pid}-1`)
    expect(existsSync(join(overlayDir, 'skills'))).toBe(true)
    expect(existsSync(join(overlayDir, 'settings.json'))).toBe(true)
    expect(existsSync(join(overlayDir, 'extensions', 'custom.ts'))).toBe(true)
    expect(existsSync(join(overlayDir, 'extensions', 'orca-titlebar-spinner.ts'))).toBe(true)

    expect(() => piTitlebarExtensionService.buildPtyEnv('1', undefined)).not.toThrow()
  })
})
