/* oxlint-disable max-lines */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { browserWindowMock, openExternalMock, attachGuestPoliciesMock, isMock } = vi.hoisted(() => ({
  browserWindowMock: vi.fn(),
  openExternalMock: vi.fn(),
  attachGuestPoliciesMock: vi.fn(),
  isMock: { dev: false }
}))

vi.mock('electron', () => ({
  BrowserWindow: browserWindowMock,
  ipcMain: { on: vi.fn(), handle: vi.fn(), removeListener: vi.fn(), removeHandler: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  shell: { openExternal: openExternalMock }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: isMock
}))

vi.mock('../../../resources/icon.png?asset', () => ({
  default: 'icon'
}))

vi.mock('../../../resources/icon-dev.png?asset', () => ({
  default: 'icon-dev'
}))

vi.mock('../browser/browser-manager', () => ({
  browserManager: {
    attachGuestPolicies: attachGuestPoliciesMock
  }
}))

import { createMainWindow } from './createMainWindow'
import { ipcMain } from 'electron'

describe('createMainWindow', () => {
  beforeEach(() => {
    browserWindowMock.mockReset()
    openExternalMock.mockReset()
    attachGuestPoliciesMock.mockReset()
    isMock.dev = false
    vi.mocked(ipcMain.on).mockReset()
    vi.mocked(ipcMain.handle).mockReset()
    vi.mocked(ipcMain.removeListener).mockReset()
    vi.mocked(ipcMain.removeHandler).mockReset()
  })

  it('enables renderer sandboxing and opens external links safely', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn((handler) => {
        windowHandlers.windowOpen = handler
      }),
      send: vi.fn(),
      isDevToolsOpened: vi.fn(),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    expect(browserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...(process.platform === 'win32'
          ? { frame: false, titleBarStyle: 'hidden' }
          : process.platform === 'darwin'
            ? { titleBarStyle: 'hiddenInset' }
            : {}),
        webPreferences: expect.objectContaining({ sandbox: true })
      })
    )

    expect(windowHandlers.windowOpen({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(windowHandlers.windowOpen({ url: 'localhost:3000' })).toEqual({ action: 'deny' })
    expect(windowHandlers.windowOpen({ url: 'file:///etc/passwd' })).toEqual({ action: 'deny' })
    expect(windowHandlers.windowOpen({ url: 'not a url' })).toEqual({ action: 'deny' })

    expect(openExternalMock).toHaveBeenCalledTimes(2)
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/')
    expect(openExternalMock).toHaveBeenCalledWith('http://localhost:3000/')

    const preventDefault = vi.fn()
    windowHandlers['will-navigate']({ preventDefault } as never, 'https://example.com/docs')
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openExternalMock).toHaveBeenCalledTimes(3)
    expect(openExternalMock).toHaveBeenLastCalledWith('https://example.com/docs')

    const localhostPreventDefault = vi.fn()
    windowHandlers['will-navigate'](
      { preventDefault: localhostPreventDefault } as never,
      'localhost:3000'
    )
    expect(localhostPreventDefault).toHaveBeenCalledTimes(1)
    expect(openExternalMock).toHaveBeenCalledTimes(4)
    expect(openExternalMock).toHaveBeenLastCalledWith('http://localhost:3000/')

    const fileNavigationPreventDefault = vi.fn()
    windowHandlers['will-navigate'](
      { preventDefault: fileNavigationPreventDefault } as never,
      'file:///etc/passwd'
    )
    expect(fileNavigationPreventDefault).toHaveBeenCalledTimes(1)
    expect(openExternalMock).toHaveBeenCalledTimes(4)

    const allowBlankEvent = { preventDefault: vi.fn() }
    const allowBlankPrefs = { partition: 'persist:orca-browser' }
    windowHandlers['will-attach-webview'](
      allowBlankEvent as never,
      allowBlankPrefs as never,
      { src: 'data:text/html,' } as never
    )
    expect(allowBlankEvent.preventDefault).not.toHaveBeenCalled()

    const denyInlineHtmlEvent = { preventDefault: vi.fn() }
    windowHandlers['will-attach-webview'](
      denyInlineHtmlEvent as never,
      { partition: 'persist:orca-browser' } as never,
      { src: 'data:text/html,<script>alert(1)</script>' } as never
    )
    expect(denyInlineHtmlEvent.preventDefault).toHaveBeenCalledTimes(1)

    const guest = { marker: 'guest' }
    windowHandlers['did-attach-webview']({} as never, guest as never)
    expect(attachGuestPoliciesMock).toHaveBeenCalledWith(guest)
  })

  it('supports all minus key variants for terminal zoom out', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    const beforeInputEvent = windowHandlers['before-input-event']

    for (const input of [
      { type: 'keyDown', control: true, meta: true, alt: false, key: '-' },
      { type: 'keyDown', control: true, meta: true, alt: false, key: '_' },
      { type: 'keyDown', control: true, meta: true, alt: false, key: 'Minus' },
      { type: 'keyDown', control: true, meta: true, alt: false, key: 'Subtract' },
      { type: 'keyDown', control: true, meta: true, alt: false, key: '', code: 'Minus' },
      { type: 'keyDown', control: true, meta: true, alt: false, key: '', code: 'NumpadSubtract' }
    ]) {
      const preventDefault = vi.fn()
      beforeInputEvent({ preventDefault } as never, input as never)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    }

    expect(webContents.send).toHaveBeenCalledTimes(6)
    expect(webContents.send).toHaveBeenNthCalledWith(1, 'terminal:zoom', 'out')
    expect(webContents.send).toHaveBeenNthCalledWith(2, 'terminal:zoom', 'out')
    expect(webContents.send).toHaveBeenNthCalledWith(3, 'terminal:zoom', 'out')
    expect(webContents.send).toHaveBeenNthCalledWith(4, 'terminal:zoom', 'out')
    expect(webContents.send).toHaveBeenNthCalledWith(5, 'terminal:zoom', 'out')
    expect(webContents.send).toHaveBeenNthCalledWith(6, 'terminal:zoom', 'out')
  })

  it('routes Electron zoom command events to terminal zoom', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    const onZoomChanged = windowHandlers['zoom-changed']
    const preventDefault = vi.fn()
    onZoomChanged({ preventDefault } as never, 'out')
    onZoomChanged({ preventDefault } as never, 'in')

    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(webContents.send).toHaveBeenCalledTimes(2)
    expect(webContents.send).toHaveBeenNthCalledWith(1, 'terminal:zoom', 'out')
    expect(webContents.send).toHaveBeenNthCalledWith(2, 'terminal:zoom', 'in')
  })

  it('does not intercept ctrl/cmd+r in before-input-event', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
      isDevToolsOpened: vi.fn(),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    for (const input of [
      { type: 'keyDown', code: 'KeyR', key: 'r', meta: false, control: true, alt: false },
      { type: 'keyDown', code: 'KeyR', key: 'r', meta: true, control: false, alt: false }
    ]) {
      const preventDefault = vi.fn()
      windowHandlers['before-input-event']({ preventDefault } as never, input as never)
      expect(preventDefault).not.toHaveBeenCalled()
    }

    expect(webContents.send).not.toHaveBeenCalled()
  })

  it('forwards ctrl/cmd+j to the worktree palette toggle event', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
      isDevToolsOpened: vi.fn(),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    const isDarwin = process.platform === 'darwin'
    for (const input of [
      {
        type: 'keyDown',
        code: 'KeyJ',
        key: 'j',
        meta: isDarwin,
        control: !isDarwin,
        alt: false,
        shift: !isDarwin
      },
      {
        type: 'keyDown',
        code: 'KeyJ',
        key: '',
        meta: isDarwin,
        control: !isDarwin,
        alt: false,
        shift: !isDarwin
      }
    ]) {
      const preventDefault = vi.fn()
      windowHandlers['before-input-event']({ preventDefault } as never, input as never)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    }

    expect(webContents.send).toHaveBeenCalledTimes(2)
    expect(webContents.send).toHaveBeenNthCalledWith(1, 'ui:toggleWorktreePalette')
    expect(webContents.send).toHaveBeenNthCalledWith(2, 'ui:toggleWorktreePalette')
  })

  it('toggles devtools on F12 in development', () => {
    isMock.dev = true

    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
      isDevToolsOpened: vi.fn(() => false),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    const preventDefault = vi.fn()
    windowHandlers['before-input-event'](
      { preventDefault } as never,
      { type: 'keyDown', code: 'F12', key: 'F12', meta: false, control: false, alt: false } as never
    )

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(webContents.openDevTools).toHaveBeenCalledWith({ mode: 'undocked' })
    expect(webContents.closeDevTools).not.toHaveBeenCalled()
  })

  it('clears the quit latch when the renderer prevents unload', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    const onQuitAborted = vi.fn()
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null, { getIsQuitting: () => true, onQuitAborted })

    const preventDefault = vi.fn()
    windowHandlers.close({ preventDefault } as never)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('window:close-requested', { isQuitting: true })

    windowHandlers['will-prevent-unload']()
    expect(onQuitAborted).toHaveBeenCalledTimes(1)
  })

  it('ignores traffic light sync IPC on non-macOS', () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      setWindowButtonPosition: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    const syncListener = vi
      .mocked(ipcMain.on)
      .mock.calls.find(([channel]) => channel === 'ui:sync-traffic-lights')?.[1]

    expect(syncListener).toBeTypeOf('function')

    syncListener?.({} as never, 1.2)

    if (process.platform === 'darwin') {
      expect(browserWindowInstance.setWindowButtonPosition).toHaveBeenCalledWith({ x: 16, y: 18 })
      return
    }

    expect(browserWindowInstance.setWindowButtonPosition).not.toHaveBeenCalled()
  })

  it('registers custom window control IPC handlers and reports current window state', async () => {
    const windowHandlers: Record<string, (...args: any[]) => void> = {}
    const webContents = {
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      setZoomLevel: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      invalidate: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      send: vi.fn()
    }
    const browserWindowInstance = {
      webContents,
      on: vi.fn((event, handler) => {
        windowHandlers[event] = handler
      }),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      show: vi.fn(),
      close: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn()
    }
    browserWindowMock.mockImplementation(function () {
      return browserWindowInstance
    })

    createMainWindow(null)

    const minimizeListener = vi
      .mocked(ipcMain.on)
      .mock.calls.find(([channel]) => channel === 'window:minimize')?.[1]
    const toggleMaximizeListener = vi
      .mocked(ipcMain.on)
      .mock.calls.find(([channel]) => channel === 'window:toggle-maximize')?.[1]
    const closeListener = vi
      .mocked(ipcMain.on)
      .mock.calls.find(([channel]) => channel === 'window:close')?.[1]
    const stateHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === 'window:get-state')?.[1]

    expect(minimizeListener).toBeTypeOf('function')
    expect(toggleMaximizeListener).toBeTypeOf('function')
    expect(closeListener).toBeTypeOf('function')
    expect(stateHandler).toBeTypeOf('function')

    minimizeListener?.({} as never)
    expect(browserWindowInstance.minimize).toHaveBeenCalledTimes(1)

    toggleMaximizeListener?.({} as never)
    expect(browserWindowInstance.maximize).toHaveBeenCalledTimes(1)

    browserWindowInstance.isMaximized.mockReturnValue(true)
    toggleMaximizeListener?.({} as never)
    expect(browserWindowInstance.unmaximize).toHaveBeenCalledTimes(1)

    closeListener?.({} as never)
    expect(browserWindowInstance.close).toHaveBeenCalledTimes(1)

    const state = await stateHandler?.({} as never)
    expect(state).toEqual({ isFullScreen: false, isMaximized: true })
  })
})
