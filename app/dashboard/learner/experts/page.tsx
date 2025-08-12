'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, AppUser } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input } from '@/components/ui'
import { ExpertProfileCard } from '@/components/ExpertProfileCard'
import { ExpertSessionCatalog } from '@/components/ExpertSessionCatalog'
import { ExpertWithSessions, ExpertBrowsingResponse } from '@/types/expert-browsing'
import { SearchIcon, FilterIcon, UserIcon } from 'lucide-react'

type ViewMode = 'browse' | 'catalog' | 'booking'

export default function ExpertBrowsingPage() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [experts, setExperts] = useState<ExpertWithSessions[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [selectedExpert, setSelectedExpert] = useState<ExpertWithSessions | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      setUser(user)
      await loadExperts()
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadExperts = async () => {
    try {
      const response = await fetch('/api/experts')
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to load experts:', errorData)
        return
      }

      const data: ExpertBrowsingResponse = await response.json()
      console.log('Loaded experts:', data.experts?.length || 0)
      setExperts(data.experts || [])
    } catch (error) {
      console.error('Error loading experts:', error)
    }
  }

  const handleViewSessions = (expertId: string) => {
    const expert = experts.find(e => e.id === expertId)
    if (expert) {
      setSelectedExpert(expert)
      setViewMode('catalog')
    }
  }

  const handleBackToExperts = () => {
    setSelectedExpert(null)
    setViewMode('browse')
  }

  const handleBookSession = (sessionId: string) => {
    // TODO: Implement booking flow
    console.log('Book session:', sessionId)
    // This will be implemented in the next milestone
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Filter experts based on search and specialty
  const filteredExperts = experts.filter(expert => {
    const matchesSearch = searchTerm === '' || 
      expert.user_profiles.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expert.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expert.sessions.some(session => 
        session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.short_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.topic_tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )

    const matchesSpecialty = selectedSpecialty === 'all' ||
      expert.expertise_areas?.includes(selectedSpecialty)

    return matchesSearch && matchesSpecialty
  })

  // Get all unique specialties for filtering
  const allSpecialties = Array.from(new Set(
    experts.flatMap(expert => expert.expertise_areas || [])
  )).sort()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading experts...</p>
        </div>
      </div>
    )
  }

  // Show session catalog view
  if (viewMode === 'catalog' && selectedExpert) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="bg-base border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-bold text-text">Expert Sessions</h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-text-light hidden sm:block">
                  {user?.email}
                </span>
                <Button onClick={handleSignOut} variant="destructive" size="sm">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ExpertSessionCatalog
            expert={selectedExpert}
            onBack={handleBackToExperts}
            onBookSession={handleBookSession}
          />
        </main>
      </div>
    )
  }

  // Main browsing view
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-base border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-text">Find Experts</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="/dashboard/learner" className="text-text-light hover:text-text">Dashboard</a>
                <span className="text-primary font-medium">Find Experts</span>
                <a href="/dashboard/learner/bookings" className="text-text-light hover:text-text">My Bookings</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text-light hidden sm:block">
                {user?.email}
              </span>
              <Button onClick={handleSignOut} variant="destructive" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text mb-2">
            Browse AI Learning Experts
          </h2>
          <p className="text-text-light">
            Find the perfect expert to help you advance your AI skills
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-light" />
                <Input
                  placeholder="Search experts, topics, or skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Specialty Filter */}
              <div className="flex items-center gap-2">
                <FilterIcon className="w-4 h-4 text-text-light" />
                <select
                  className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                >
                  <option value="all">All Specialties</option>
                  {allSpecialties.map(specialty => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-text-light">
            {filteredExperts.length === experts.length 
              ? `Showing all ${experts.length} experts`
              : `Showing ${filteredExperts.length} of ${experts.length} experts`
            }
            {searchTerm && ` matching "${searchTerm}"`}
            {selectedSpecialty !== 'all' && ` in ${selectedSpecialty}`}
          </p>
        </div>

        {/* Expert Cards */}
        {filteredExperts.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <UserIcon className="w-16 h-16 mx-auto text-text-light mb-4" />
              <CardTitle>No Experts Found</CardTitle>
              <CardDescription>
                {experts.length === 0 
                  ? 'No experts are available at the moment.'
                  : 'Try adjusting your search criteria to find more experts.'
                }
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExperts.map(expert => (
              <ExpertProfileCard
                key={expert.id}
                expert={expert}
                onViewSessions={handleViewSessions}
                showSessions={true}
              />
            ))}
          </div>
        )}

        {/* Load More / Pagination could go here */}
        {filteredExperts.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-text-light">
              Showing {filteredExperts.length} expert{filteredExperts.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}