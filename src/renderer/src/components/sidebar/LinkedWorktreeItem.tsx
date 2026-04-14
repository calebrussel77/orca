import type { Worktree } from '../../../../shared/types'

export function LinkedWorktreeItem({
  worktree,
  onOpen
}: {
  worktree: Worktree
  onOpen: () => void
}): React.JSX.Element {
  const branchLabel = worktree.branch.replace(/^refs\/heads\//, '')

  return (
    <button
      className="group flex items-center justify-between gap-3 w-full rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-accent cursor-pointer"
      onClick={onOpen}
    >
      <div className="min-w-0">
        <p className="text-base font-medium text-foreground truncate">{worktree.displayName}</p>
        {branchLabel !== worktree.displayName && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{branchLabel}</p>
        )}
      </div>
      <span className="shrink-0 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        Open
      </span>
    </button>
  )
}
