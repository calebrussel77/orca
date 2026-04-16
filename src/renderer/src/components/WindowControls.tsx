import { useEffect, useState } from 'react'

const isWindows = navigator.userAgent.includes('Windows')

type WindowState = {
  isFullScreen: boolean
  isMaximized: boolean
}

export function WindowControls(): React.JSX.Element | null {
  const [windowState, setWindowState] = useState<WindowState>({
    isFullScreen: false,
    isMaximized: false
  })

  useEffect(() => {
    if (!isWindows) {
      return
    }

    let mounted = true

    // Why: the main window maximizes before the renderer finishes mounting on
    // startup. Read the current state once, then subscribe to live changes so
    // the maximize/restore glyph always matches the actual BrowserWindow state.
    void window.api.ui.getWindowState().then((nextState) => {
      if (mounted) {
        setWindowState(nextState)
      }
    })

    const unsubscribe = window.api.ui.onWindowStateChanged((nextState) => {
      setWindowState(nextState)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  if (!isWindows) {
    return null
  }

  return (
    <div className="window-controls" aria-label="Window controls">
      <button
        type="button"
        className="window-control-button"
        onClick={() => window.api.ui.minimizeWindow()}
        aria-label="Minimize window"
      >
        <span className="window-control-glyph window-control-glyph-minimize" aria-hidden />
      </button>
      <button
        type="button"
        className="window-control-button"
        onClick={() => window.api.ui.toggleMaximizeWindow()}
        aria-label={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
      >
        <span
          className={`window-control-glyph ${windowState.isMaximized ? 'window-control-glyph-restore' : 'window-control-glyph-maximize'}`}
          aria-hidden
        />
      </button>
      <button
        type="button"
        className="window-control-button window-control-button-close"
        onClick={() => window.api.ui.closeWindow()}
        aria-label="Close window"
      >
        <span className="window-control-glyph window-control-glyph-close" aria-hidden />
      </button>
    </div>
  )
}
