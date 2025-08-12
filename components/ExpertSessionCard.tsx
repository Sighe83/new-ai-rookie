'use client'

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { 
  ExpertSession, 
  ExpertSessionWithAvailability, 
  formatSessionPrice, 
  calculateHourlyRate
} from '@/types/expert-sessions'

interface ExpertSessionCardProps {
  session: ExpertSession | ExpertSessionWithAvailability
  onBook?: (sessionId: string) => void
  onEdit?: (sessionId: string) => void
  onToggleActive?: (sessionId: string, isActive: boolean) => void
  showActions?: boolean
  showAvailability?: boolean
  isOwner?: boolean
}

export function ExpertSessionCard({ 
  session, 
  onBook, 
  onEdit, 
  onToggleActive, 
  showActions = true,
  showAvailability = false,
  isOwner = false
}: ExpertSessionCardProps) {
  const hasAvailability = 'has_availability' in session ? session.has_availability : undefined
  const expertInfo = 'expert_display_name' in session ? {
    name: session.expert_display_name,
    bio: session.expert_bio,
    rating: session.expert_rating,
    totalSessions: session.expert_total_sessions
  } : undefined

  const levelColor = session.level ? {
    'BEGINNER': 'bg-green-100 text-green-800',
    'INTERMEDIATE': 'bg-yellow-100 text-yellow-800',
    'ADVANCED': 'bg-red-100 text-red-800'
  }[session.level] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'

  return (
    <Card className={`h-full transition-all hover:shadow-lg ${!session.is_active ? 'opacity-75 bg-gray-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg line-clamp-2">{session.title}</CardTitle>
          {!session.is_active && (
            <Badge variant="neutral" className="bg-gray-200 text-gray-600">
              Inactive
            </Badge>
          )}
        </div>
        
        {expertInfo && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{expertInfo.name}</span>
            {expertInfo.rating > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  ⭐ {expertInfo.rating.toFixed(1)}
                </span>
              </>
            )}
            {expertInfo.totalSessions > 0 && (
              <>
                <span>•</span>
                <span>{expertInfo.totalSessions} sessions</span>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-gray-600 line-clamp-3">{session.short_description}</p>

        {/* Session Details */}
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <Badge variant="neutral">{session.duration_minutes} min</Badge>
          
          {session.level && (
            <Badge className={levelColor}>
              {session.level}
            </Badge>
          )}
          
          {showAvailability && hasAvailability !== undefined && (
            <Badge 
              variant={hasAvailability ? "success" : "neutral"}
              className={hasAvailability ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
            >
              {hasAvailability ? "Available" : "No availability"}
            </Badge>
          )}
        </div>

        {/* Topic Tags */}
        <div className="flex flex-wrap gap-1">
          {session.topic_tags.slice(0, 4).map(tag => (
            <Badge key={tag} variant="neutral" className="text-xs">
              {tag}
            </Badge>
          ))}
          {session.topic_tags.length > 4 && (
            <Badge variant="neutral" className="text-xs">
              +{session.topic_tags.length - 4} more
            </Badge>
          )}
        </div>

        {/* Pricing */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-semibold text-primary">
                {formatSessionPrice(session.price_amount, session.currency)}
              </div>
              <div className="text-xs text-gray-500">
                {calculateHourlyRate(session.price_amount, session.duration_minutes, session.currency)}
              </div>
            </div>

            {showActions && (
              <div className="flex gap-2">
                {isOwner ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEdit?.(session.id)}
                    >
                      Edit
                    </Button>
                    
                    {onToggleActive && (
                      <Button
                        variant={session.is_active ? "destructive" : "primary"}
                        size="sm"
                        onClick={() => onToggleActive(session.id, !session.is_active)}
                      >
                        {session.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onBook?.(session.id)}
                    disabled={showAvailability && hasAvailability === false}
                  >
                    Book Session
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Prerequisites (if any) */}
        {session.prerequisites && (
          <div className="border-t pt-3">
            <div className="text-sm">
              <span className="font-medium text-gray-700">Prerequisites: </span>
              <span className="text-gray-600">{session.prerequisites}</span>
            </div>
          </div>
        )}

        {/* Materials URL (if any) */}
        {session.materials_url && (
          <div className="border-t pt-2">
            <a
              href={session.materials_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              📚 Preparation materials
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}