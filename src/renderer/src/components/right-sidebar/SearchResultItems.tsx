import React, { useMemo } from 'react'
import { ChevronRight, Copy } from 'lucide-react'
import { VscodeEntryIcon } from '@/components/VscodeEntryIcon'
import { basename, dirname } from '@/lib/path'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/components/ui/context-menu'
import type { SearchFileResult, SearchMatch } from '../../../../shared/types'

// ─── Toggle Button ────────────────────────────────────────
export function ToggleButton({
  active,
  onClick,
  title,
  children,
  ariaExpanded
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  ariaExpanded?: boolean
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn(
        'h-auto w-auto rounded-sm p-0.5 flex-shrink-0',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      aria-expanded={ariaExpanded}
    >
      {children}
    </Button>
  )
}

// ─── File Result ──────────────────────────────────────────
export function FileResultRow({
  fileResult,
  onToggleCollapse,
  collapsed
}: {
  fileResult: SearchFileResult
  onToggleCollapse: () => void
  collapsed: boolean
}): React.JSX.Element {
  const fileName = basename(fileResult.relativePath)
  const parentDir = dirname(fileResult.relativePath)
  const dirPath = parentDir === '.' ? '' : parentDir

  return (
    <div className="pt-1.5">
      {/* File header with context menu */}
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-1.5 rounded-none px-2 py-1 text-left text-sm group"
                  onClick={onToggleCollapse}
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 flex-shrink-0 text-muted-foreground transition-transform',
                      !collapsed && 'rotate-90'
                    )}
                  />
                  <VscodeEntryIcon
                    pathValue={fileResult.relativePath}
                    kind="file"
                    className="size-3.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="min-w-0 block truncate">
                      <span className="text-foreground">{fileName}</span>
                      {dirPath && (
                        <span className="ml-1.5 text-[0.85em] text-muted-foreground">
                          {dirPath}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="rounded-full bg-muted/80 px-1.5 text-[0.75em] text-muted-foreground flex-shrink-0">
                    {fileResult.matches.length}
                  </span>
                </Button>
              </TooltipTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => window.api.ui.writeClipboardText(fileResult.relativePath)}
              >
                <Copy className="size-3.5" />
                Copy Path
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {/* Why: the row label intentionally truncates long parent paths to
             keep the result list compact, so the tooltip preserves the full
             relative path for copy/verification without widening the row. */}
          <TooltipContent side="top" sideOffset={6}>
            {fileResult.relativePath}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// ─── Match Item ───────────────────────────────────────────
export function MatchResultRow({
  match,
  relativePath,
  onClick
}: {
  match: SearchMatch
  relativePath: string
  onClick: () => void
}): React.JSX.Element {
  // Highlight the matched text within the line
  const parts = useMemo(() => {
    const content = match.lineContent
    const col = match.column - 1 // convert to 0-indexed
    const len = match.matchLength

    if (col >= 0 && col + len <= content.length) {
      return {
        before: content.slice(0, col),
        match: content.slice(col, col + len),
        after: content.slice(col + len)
      }
    }

    // Fallback
    return { before: content, match: '', after: '' }
  }, [match.lineContent, match.column, match.matchLength])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="min-h-[22px] h-auto w-full justify-start gap-1.5 rounded-none py-0.5 pr-2 pl-8 text-left text-sm"
          onMouseDown={(event) => {
            // Why: clicking a result should move focus into the opened editor.
            // If the sidebar button takes focus first, the browser can restore
            // it after the click and make the initial reveal feel flaky.
            if (event.button === 0) {
              event.preventDefault()
            }
          }}
          onClick={onClick}
        >
          <span className="mt-px flex-shrink-0 tabular-nums text-[0.8em] text-muted-foreground">
            {match.line}
          </span>
          <span className="truncate">
            <span className="text-muted-foreground">{parts.before.trimStart()}</span>
            {parts.match && (
              <span className="bg-amber-500/30 text-foreground rounded-sm">{parts.match}</span>
            )}
            <span className="text-muted-foreground">{parts.after}</span>
          </span>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => window.api.ui.writeClipboardText(`${relativePath}#L${match.line}`)}
        >
          <Copy className="size-3.5" />
          Copy Line Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
