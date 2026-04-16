import React, { memo, useMemo, useState } from 'react'
import { FileIcon, FolderIcon } from 'lucide-react'
import { useAppStore } from '@/store'
import { getSystemPrefersDark } from '@/lib/terminal-theme'
import { cn } from '@/lib/utils'
import { getVscodeIconUrlForEntry } from '@/lib/vscode-icons'

export const VscodeEntryIcon = memo(function VscodeEntryIcon({
  pathValue,
  kind,
  className
}: {
  pathValue: string
  kind: 'file' | 'directory'
  className?: string
}): React.JSX.Element {
  const settingsTheme = useAppStore((state) => state.settings?.theme)
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null)

  const themeMode =
    settingsTheme === 'system' || !settingsTheme
      ? getSystemPrefersDark()
        ? 'dark'
        : 'light'
      : settingsTheme

  const iconUrl = useMemo(
    () => getVscodeIconUrlForEntry(pathValue, kind, themeMode),
    [kind, pathValue, themeMode]
  )
  const failed = failedIconUrl === iconUrl

  if (failed) {
    return kind === 'directory' ? (
      <FolderIcon className={cn('size-4 shrink-0 text-muted-foreground/80', className)} />
    ) : (
      <FileIcon className={cn('size-4 shrink-0 text-muted-foreground/80', className)} />
    )
  }

  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={cn('size-4 shrink-0', className)}
      onError={() => setFailedIconUrl(iconUrl)}
    />
  )
})
