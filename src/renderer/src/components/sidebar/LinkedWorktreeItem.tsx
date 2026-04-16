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
      className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
      onClick={onOpen}
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-snug tracking-[-0.005em] text-foreground">
          {worktree.displayName}
        </p>
        {branchLabel !== worktree.displayName && (
          <p className="mt-0.5 truncate font-mono text-[13px] text-muted-foreground">
            {branchLabel}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors group-hover:text-foreground">
        Open
      </span>
    </button>
  )
}
