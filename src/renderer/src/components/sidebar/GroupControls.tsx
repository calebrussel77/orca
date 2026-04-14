import React from 'react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

type GroupOption = {
  value: 'none' | 'pr-status' | 'repo'
  label: string
}

const OPTIONS: readonly GroupOption[] = [
  { value: 'none', label: 'All' },
  { value: 'pr-status', label: 'PR Status' },
  { value: 'repo', label: 'Repo' }
] as const

const GroupControls = React.memo(function GroupControls() {
  const groupBy = useAppStore((s) => s.groupBy)
  const setGroupBy = useAppStore((s) => s.setGroupBy)

  return (
    <div
      role="tablist"
      aria-label="Group worktrees"
      // Why the bottom border is rendered on the wrapper rather than on each
      // tab: the active underline sits flush against this line, so keeping it
      // as a single element prevents sub-pixel seams between the indicator and
      // the separator when the sidebar is resized.
      className="mx-3 mb-2 flex items-end gap-0.5 border-b border-border/50"
    >
      {OPTIONS.map((opt) => {
        const isActive = groupBy === opt.value
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => setGroupBy(opt.value)}
            className={cn(
              'relative inline-flex h-7 cursor-pointer items-center px-2.5 text-xs font-medium transition-colors outline-none',
              'focus-visible:text-foreground',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/85'
            )}
          >
            {opt.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-px h-[1.5px] rounded-full bg-foreground"
              />
            )}
          </button>
        )
      })}
    </div>
  )
})

export default GroupControls
