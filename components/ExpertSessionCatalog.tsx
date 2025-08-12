'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'
import { ExpertWithSessions, getExpertDisplayName } from '@/types/expert-browsing'
import { ExpertSession, formatSessionPrice, calculateHourlyRate, SessionLevel } from '@/types/expert-sessions'
import { UserIcon, ClockIcon, TagIcon, StarIcon, BookOpenIcon, ArrowLeftIcon } from 'lucide-react'

interface ExpertSessionCatalogProps {
  expert: ExpertWithSessions
  onBack: () => void
  onBookSession?: (sessionId: string) => void
}

export function ExpertSessionCatalog({ 
  expert, 
  onBack, 
  onBookSession 
}: ExpertSessionCatalogProps) {
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  
  const displayName = getExpertDisplayName(expert)
  const activeSessions = expert.sessions || []
  
  // Filter sessions by level
  const filteredSessions = selectedLevel === 'all' 
    ? activeSessions
    : activeSessions.filter(session => session.level === selectedLevel)
  
  // Get unique levels available
  const availableLevels = Array.from(new Set(
    activeSessions.map(session => session.level).filter((level): level is SessionLevel => Boolean(level))
  ))
  
  // Get all unique topic tags
  const allTopicTags = Array.from(new Set(
    activeSessions.flatMap(session => session.topic_tags || [])
  ))

  const SessionCard = ({ session }: { session: ExpertSession }) => {
    const hourlyRate = session.price_amount > 0 && session.duration_minutes > 0
      ? calculateHourlyRate(session.price_amount, session.duration_minutes, session.currency)
      : null

    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg">{session.title}</CardTitle>
              {session.level && (
                <Badge variant="neutral" className="mt-1 text-xs">
                  {session.level}
                </Badge>
              )}
            </div>
            <div className="text-right">
              <div className="font-bold text-lg">
                {formatSessionPrice(session.price_amount, session.currency)}
              </div>
              <div className="text-sm text-text-light">
                {session.duration_minutes} minutes
              </div>
              {hourlyRate && (
                <div className="text-xs text-text-light">
                  {hourlyRate} hourly
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="text-sm leading-relaxed">
            {session.short_description}
          </CardDescription>
          
          {session.topic_tags && session.topic_tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TagIcon className="w-4 h-4 text-text-light" />
                <span className="text-sm font-medium">Topics</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {session.topic_tags.map(tag => (
                  <Badge key={tag} variant="neutral" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {session.prerequisites && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpenIcon className="w-4 h-4 text-text-light" />
                <span className="text-sm font-medium">Prerequisites</span>
              </div>
              <p className="text-sm text-text-light">
                {session.prerequisites}
              </p>
            </div>
          )}
          
          <div className="pt-4">
            <Button 
              variant="primary"
              className="w-full"
              onClick={() => {
                onBookSession?.(session.id)
                router.push(`/dashboard/learner/book/${session.id}`)
              }}
            >
              Book This Session
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Experts
        </Button>
        
        <div className="flex items-center gap-4">
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
          
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <div className="flex items-center gap-2 text-sm text-text-light">
              {expert.rating && (
                <>
                  <StarIcon className="w-4 h-4" />
                  <span>{expert.rating.toFixed(1)} ⭐</span>
                  <span>•</span>
                </>
              )}
              <span>{expert.total_sessions || 0} sessions completed</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Expert Info */}
      {expert.bio && (
        <Card>
          <CardContent className="p-6">
            <p className="text-text-light">{expert.bio}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Specialties and Topics */}
      <div className="grid md:grid-cols-2 gap-6">
        {expert.expertise_areas && expert.expertise_areas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Specialties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {expert.expertise_areas.map((specialty, index) => (
                  <Badge key={index} variant="primary" className="text-sm">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {allTopicTags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {allTopicTags.slice(0, 12).map(tag => (
                  <Badge key={tag} variant="neutral" className="text-sm">
                    {tag}
                  </Badge>
                ))}
                {allTopicTags.length > 12 && (
                  <Badge variant="neutral" className="text-sm">
                    +{allTopicTags.length - 12} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Sessions */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Available Sessions ({activeSessions.length})
          </h2>
          
          {/* Level Filter */}
          {availableLevels.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-light">Level:</span>
              <div className="flex gap-1">
                <Button
                  variant={selectedLevel === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedLevel('all')}
                >
                  All
                </Button>
                {availableLevels.map(level => (
                  <Button
                    key={level}
                    variant={selectedLevel === level ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedLevel(level || 'all')}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {filteredSessions.length === 0 ? (
          <Card className="text-center p-12">
            <CardContent>
              <ClockIcon className="w-12 h-12 mx-auto text-text-light mb-4" />
              <h3 className="text-lg font-medium mb-2">No Sessions Available</h3>
              <p className="text-text-light">
                {selectedLevel !== 'all' 
                  ? `No ${selectedLevel.toLowerCase()} level sessions available.`
                  : 'This expert has no active sessions at the moment.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}