import React, { useCallback } from 'react'
import { Search, X, Activity, FolderTree, FolderPlus } from 'lucide-react'
import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import RepoDotLabel from '@/components/repo/RepoDotLabel'

const SearchBar = React.memo(function SearchBar() {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const showActiveOnly = useAppStore((s) => s.showActiveOnly)
  const setShowActiveOnly = useAppStore((s) => s.setShowActiveOnly)
  const filterRepoIds = useAppStore((s) => s.filterRepoIds)
  const setFilterRepoIds = useAppStore((s) => s.setFilterRepoIds)
  const repos = useAppStore((s) => s.repos)
  const addRepo = useAppStore((s) => s.addRepo)
  const selectedRepos = repos.filter((r) => filterRepoIds.includes(r.id))

  const handleToggleRepo = useCallback(
    (repoId: string) => {
      setFilterRepoIds(
        filterRepoIds.includes(repoId)
          ? filterRepoIds.filter((id) => id !== repoId)
          : [...filterRepoIds, repoId]
      )
    },
    [filterRepoIds, setFilterRepoIds]
  )

  const repoTriggerLabel =
    selectedRepos.length === 0 ? (
      <span className="flex items-center gap-1">
        <FolderTree className="size-3 text-muted-foreground" />
        <span>All</span>
      </span>
    ) : selectedRepos.length === 1 ? (
      <RepoDotLabel
        name={selectedRepos[0].displayName}
        color={selectedRepos[0].badgeColor}
        dotClassName="size-1"
      />
    ) : (
      <span className="flex items-center gap-1">
        <FolderTree className="size-3 text-muted-foreground" />
        <span>{selectedRepos.length} repos</span>
      </span>
    )

  const handleClear = useCallback(() => setSearchQuery(''), [setSearchQuery])
  const handleToggleActive = useCallback(
    () => setShowActiveOnly(!showActiveOnly),
    [showActiveOnly, setShowActiveOnly]
  )

  return (
    <div className="px-3 pb-3">
      <div className="group/search relative flex items-center rounded-md border border-border/60 bg-muted/40 transition-colors focus-within:border-ring/40 focus-within:bg-muted/60 hover:bg-muted/55">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search workspaces"
          className="h-8 rounded-md border-none bg-transparent pl-8 pr-24 text-sm shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 md:text-sm"
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {searchQuery && (
            <Button variant="ghost" size="icon-xs" onClick={handleClear} className="size-6">
              <X className="size-3" />
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleToggleActive}
                className={cn(
                  'relative size-6',
                  showActiveOnly && 'bg-accent text-accent-foreground'
                )}
              >
                <Activity className="size-3" />
                {showActiveOnly ? (
                  <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-green-500 ring-1 ring-background" />
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {showActiveOnly ? 'Show all' : 'Active only'}
            </TooltipContent>
          </Tooltip>
          {repos.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  aria-label="Filter repositories"
                  className="h-6 w-auto gap-1 border-none bg-transparent px-1.5 text-sm font-normal shadow-none hover:bg-accent/60 focus-visible:ring-0"
                >
                  {repoTriggerLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setFilterRepoIds([])
                  }}
                >
                  All repos
                </DropdownMenuItem>
                {repos.map((r) => (
                  <DropdownMenuCheckboxItem
                    key={r.id}
                    checked={filterRepoIds.includes(r.id)}
                    onCheckedChange={() => handleToggleRepo(r.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    <RepoDotLabel name={r.displayName} color={r.badgeColor} />
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  inset
                  onSelect={() => {
                    addRepo()
                  }}
                >
                  <FolderPlus className="absolute left-2.5 size-3.5 text-muted-foreground" />
                  Add repo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
})

export default SearchBar
