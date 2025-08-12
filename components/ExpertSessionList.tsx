'use client'

import { useState, useEffect } from 'react'
import { ExpertSessionCard } from './ExpertSessionCard'
import { Button, Input, Select, Badge } from '@/components/ui'
import { 
  ExpertSessionWithAvailability, 
  ExpertSessionFilters,
  DURATION_OPTIONS,
  COMMON_TOPIC_TAGS,
  SESSION_LEVEL_DESCRIPTIONS
} from '@/types/expert-sessions'

interface ExpertSessionListProps {
  sessions?: ExpertSessionWithAvailability[]
  loading?: boolean
  onBook?: (sessionId: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  showFilters?: boolean
  showAvailability?: boolean
  onFiltersChange?: (filters: ExpertSessionFilters) => void
  initialFilters?: ExpertSessionFilters
}

export function ExpertSessionList({ 
  sessions = [],
  loading = false,
  onBook,
  onLoadMore,
  hasMore = false,
  showFilters = true,
  showAvailability = true,
  onFiltersChange,
  initialFilters = {}
}: ExpertSessionListProps) {
  const [filters, setFilters] = useState<ExpertSessionFilters>(initialFilters)
  const [showAllFilters, setShowAllFilters] = useState(false)

  useEffect(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])

  const updateFilter = (key: keyof ExpertSessionFilters, value: unknown) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    const clearedFilters: ExpertSessionFilters = {
      has_availability_only: filters.has_availability_only // Keep availability filter
    }
    setFilters(clearedFilters)
  }

  const addTopicTag = (tag: string) => {
    const currentTags = filters.topic_tags || []
    if (!currentTags.includes(tag)) {
      updateFilter('topic_tags', [...currentTags, tag])
    }
  }

  const removeTopicTag = (tag: string) => {
    const currentTags = filters.topic_tags || []
    updateFilter('topic_tags', currentTags.filter(t => t !== tag))
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
    key !== 'has_availability_only' && value !== undefined && value !== '' && 
    !(Array.isArray(value) && value.length === 0)
  )

  if (loading && sessions.length === 0) {
    return (
      <div className="space-y-4">
        {showFilters && (
          <div className="bg-white rounded-lg border p-4 mb-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        )}
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-white rounded-lg border p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-24 ml-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border p-6">
          <div className="space-y-4">
            {/* Search and main filters */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                placeholder="Search sessions..."
                value={filters.search_query || ''}
                onChange={(e) => updateFilter('search_query', e.target.value)}
              />
              
              <Select
                value={filters.level || ''}
                onChange={(e) => updateFilter('level', e.target.value || undefined)}
              >
                <option value="">All levels</option>
                {Object.entries(SESSION_LEVEL_DESCRIPTIONS).map(([level]) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.min_duration?.toString() || ''}
                onChange={(e) => updateFilter('min_duration', e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">Any duration</option>
                {DURATION_OPTIONS.slice(0, 6).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}+ minimum
                  </option>
                ))}
              </Select>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.has_availability_only || false}
                    onChange={(e) => updateFilter('has_availability_only', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Available only
                </label>
              </div>
            </div>

            {/* Advanced filters toggle */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAllFilters(!showAllFilters)}
            >
              {showAllFilters ? 'Hide' : 'Show'} advanced filters
            </Button>

            {/* Advanced filters */}
            {showAllFilters && (
              <div className="border-t pt-4 space-y-4">
                {/* Price range */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    placeholder="Min price (øre/cents)"
                    value={filters.min_price || ''}
                    onChange={(e) => updateFilter('min_price', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                  <Input
                    type="number"
                    placeholder="Max price (øre/cents)"
                    value={filters.max_price || ''}
                    onChange={(e) => updateFilter('max_price', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>

                {/* Topic tags */}
                <div>
                  <label className="block text-sm font-medium mb-2">Topic tags</label>
                  
                  {/* Selected tags */}
                  {filters.topic_tags && filters.topic_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {filters.topic_tags.map(tag => (
                        <Badge 
                          key={tag} 
                          variant="primary"
                          className="cursor-pointer hover:bg-red-100"
                          onClick={() => removeTopicTag(tag)}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Common tag buttons */}
                  <div className="flex flex-wrap gap-2">
                    {COMMON_TOPIC_TAGS.slice(0, 12).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          filters.topic_tags?.includes(tag)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white hover:bg-gray-50 border-gray-300'
                        }`}
                        onClick={() => 
                          filters.topic_tags?.includes(tag) 
                            ? removeTopicTag(tag) 
                            : addTopicTag(tag)
                        }
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm text-gray-600">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''} found
                </span>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {sessions.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {hasActiveFilters ? '🔍 No sessions match your filters' : '📚 No sessions available'}
          </div>
          {hasActiveFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters to see all sessions
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Session grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map(session => (
              <ExpertSessionCard
                key={session.id}
                session={session}
                onBook={onBook}
                showAvailability={showAvailability}
              />
            ))}
          </div>

          {/* Loading indicator */}
          {loading && sessions.length > 0 && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          )}

          {/* Load more button */}
          {hasMore && !loading && (
            <div className="text-center">
              <Button onClick={onLoadMore} variant="secondary">
                Load more sessions
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}