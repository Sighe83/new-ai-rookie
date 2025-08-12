'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from '@/components/ui'
import { ExpertWithSessions, getExpertDisplayName, getExpertRatingDisplay, getTotalSessionsDisplay } from '@/types/expert-browsing'
import { formatSessionPrice } from '@/types/expert-sessions'
import { UserIcon, StarIcon, ClockIcon, TagIcon } from 'lucide-react'

interface ExpertProfileCardProps {
  expert: ExpertWithSessions
  onViewSessions: (expertId: string) => void
  showSessions?: boolean
}

export function ExpertProfileCard({ 
  expert, 
  onViewSessions, 
  showSessions = false 
}: ExpertProfileCardProps) {
  const [showAllSessions, setShowAllSessions] = useState(false)
  
  const displayName = getExpertDisplayName(expert)
  const ratingDisplay = getExpertRatingDisplay(expert)
  const totalSessionsDisplay = getTotalSessionsDisplay(expert)
  
  const activeSessions = expert.sessions || []
  const displayedSessions = showAllSessions ? activeSessions : activeSessions.slice(0, 3)
  
  // Get unique topic tags from all sessions
  const allTopicTags = Array.from(new Set(
    activeSessions.flatMap(session => session.topic_tags || [])
  )).slice(0, 8) // Show max 8 tags
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            {expert.user_profiles.avatar_url ? (
              <img 
                src={expert.user_profiles.avatar_url} 
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="w-6 h-6 text-text-light" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{displayName}</CardTitle>
            <div className="space-y-1">
              <CardDescription className="flex items-center gap-2 text-sm">
                <StarIcon className="w-4 h-4" />
                <span>{ratingDisplay}</span>
                <span>•</span>
                <span>{totalSessionsDisplay}</span>
              </CardDescription>
              {expert.expertise_areas && expert.expertise_areas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {expert.expertise_areas.slice(0, 3).map((specialty, index) => (
                    <Badge key={index} variant="neutral" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                  {expert.expertise_areas.length > 3 && (
                    <Badge variant="neutral" className="text-xs">
                      +{expert.expertise_areas.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {expert.bio && (
          <p className="text-sm text-text-light mt-3 line-clamp-2">
            {expert.bio}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Topic Tags */}
        {allTopicTags.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TagIcon className="w-4 h-4 text-text-light" />
              <span className="text-sm font-medium">Topics</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {allTopicTags.map(tag => (
                <Badge key={tag} variant="neutral" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Active Sessions Preview */}
        {activeSessions.length > 0 && showSessions && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-text-light" />
                <span className="text-sm font-medium">
                  Available Sessions ({activeSessions.length})
                </span>
              </div>
              {activeSessions.length > 3 && (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowAllSessions(!showAllSessions)}
                  className="text-xs"
                >
                  {showAllSessions ? 'Show Less' : 'Show All'}
                </Button>
              )}
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {displayedSessions.map(session => (
                <div key={session.id} className="p-2 bg-surface rounded-lg">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{session.title}</h4>
                      <p className="text-xs text-text-light mt-1 line-clamp-2">
                        {session.short_description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-sm">
                        {formatSessionPrice(session.price_amount, session.currency)}
                      </p>
                      <p className="text-xs text-text-light">
                        {session.duration_minutes} min
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeSessions.length === 0 && showSessions && (
          <div className="text-center text-text-light">
            <p className="text-sm">No active sessions available</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4">
        <Button 
          variant="primary" 
          className="w-full"
          onClick={() => onViewSessions(expert.id)}
          disabled={activeSessions.length === 0}
        >
          {activeSessions.length === 0 
            ? 'No Sessions Available' 
            : `View ${activeSessions.length} Session${activeSessions.length !== 1 ? 's' : ''}`
          }
        </Button>
      </CardFooter>
    </Card>
  )
}