import { useState, useMemo } from 'react'
import { KanbanColumn } from './KanbanColumn'
import { Search, Filter, X } from 'lucide-react'
import type { Feature, FeatureListResponse } from '../lib/types'

interface KanbanBoardProps {
  features: FeatureListResponse | undefined
  onFeatureClick: (feature: Feature) => void
  onAddFeature?: () => void
  onExpandProject?: () => void
  showFilter?: boolean
}

export function KanbanBoard({ features, onFeatureClick, onAddFeature, onExpandProject, showFilter = false }: KanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const hasFeatures = features && (features.pending.length + features.in_progress.length + features.done.length) > 0

  // Extract unique categories from all features
  const categories = useMemo(() => {
    if (!features) return []
    const allFeatures = [...features.pending, ...features.in_progress, ...features.done]
    const uniqueCategories = [...new Set(allFeatures.map(f => f.category).filter(Boolean))]
    return uniqueCategories.sort()
  }, [features])

  // Filter features by search query and category
  const filterFeatures = (featureList: Feature[]): Feature[] => {
    return featureList.filter(feature => {
      const matchesSearch = searchQuery === '' ||
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === '' || feature.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }

  const filteredFeatures = useMemo(() => {
    if (!features) return undefined
    return {
      pending: filterFeatures(features.pending),
      in_progress: filterFeatures(features.in_progress),
      done: filterFeatures(features.done),
    }
  }, [features, searchQuery, selectedCategory])

  const hasActiveFilter = searchQuery !== '' || selectedCategory !== ''
  const totalFiltered = filteredFeatures
    ? filteredFeatures.pending.length + filteredFeatures.in_progress.length + filteredFeatures.done.length
    : 0
  const totalOriginal = features
    ? features.pending.length + features.in_progress.length + features.done.length
    : 0

  if (!features) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['Pending', 'In Progress', 'Done'].map(title => (
          <div key={title} className="neo-card p-4">
            <div className="h-8 bg-[var(--color-neo-bg)] animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--color-neo-bg)] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      {hasFeatures && showFilter && (
        <div className="neo-card p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neo-text-secondary)]" />
              <input
                type="text"
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="neo-input pl-10 pr-10 w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-neo-text-secondary)] hover:text-[var(--color-neo-text)]"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative min-w-[180px]">
              <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neo-text-secondary)]" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="neo-input pl-10 pr-8 w-full appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              </div>
            </div>

            {/* Clear Filters & Count */}
            {hasActiveFilter && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-neo-text-secondary)]">
                  Showing {totalFiltered} of {totalOriginal}
                </span>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('')
                  }}
                  className="neo-btn neo-btn-ghost text-sm py-1.5 px-3"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KanbanColumn
          title="Pending"
          count={filteredFeatures?.pending.length ?? 0}
          features={filteredFeatures?.pending ?? []}
          color="pending"
          onFeatureClick={onFeatureClick}
          onAddFeature={onAddFeature}
          onExpandProject={onExpandProject}
          showExpandButton={hasFeatures}
        />
        <KanbanColumn
          title="In Progress"
          count={filteredFeatures?.in_progress.length ?? 0}
          features={filteredFeatures?.in_progress ?? []}
          color="progress"
          onFeatureClick={onFeatureClick}
        />
        <KanbanColumn
          title="Done"
          count={filteredFeatures?.done.length ?? 0}
          features={filteredFeatures?.done ?? []}
          color="done"
          onFeatureClick={onFeatureClick}
        />
      </div>
    </div>
  )
}
