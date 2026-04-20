import { useEffect } from 'react'
import { attachAppFilesystemWatchController } from './filesystem-watch-controller'

export default function FilesystemWatchController(): null {
  useEffect(() => {
    return attachAppFilesystemWatchController()
  }, [])

  return null
}
