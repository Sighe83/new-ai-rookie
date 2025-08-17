'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { ExpertProfile, UserProfile } from '@/lib/supabase'

interface ExpertWithAuth extends UserProfile {
  expert_profile: ExpertProfile[]
  email_confirmed?: boolean
  last_sign_in?: string
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create')
  const [loading, setLoading] = useState(false)
  const [experts, setExperts] = useState<ExpertWithAuth[]>([])
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  
  // Form state for creating expert
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    display_name: '',
    bio: '',
    title: '',
    company: '',
    years_of_experience: '',
    expertise_areas: '',
    hourly_rate: '',
    linkedin_url: '',
    github_url: '',
    website_url: ''
  })

  useEffect(() => {
    if (activeTab === 'manage') {
      fetchExperts()
    }
  }, [activeTab])

  const fetchExperts = async () => {
    try {
      // First get the expert profiles
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          expert_profile:expert_profiles(*)
        `)
        .eq('role', 'expert')
        .order('created_at', { ascending: false })

      if (profileError) throw profileError

      // Get the current user's session to make admin calls
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Fetch auth user details for each expert to get email verification status
      const expertsWithAuthData = await Promise.all(
        (profileData || []).map(async (expert) => {
          try {
            // Use admin API to get user auth details
            const response = await fetch('/api/admin/get-user-auth', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ user_id: expert.user_id })
            })
            
            if (response.ok) {
              const authData = await response.json()
              return {
                ...expert,
                email_confirmed: authData.user?.email_confirmed_at ? true : false,
                last_sign_in: authData.user?.last_sign_in_at
              }
            }
          } catch (err) {
            console.error('Error fetching auth data for expert:', expert.email, err)
          }
          
          return {
            ...expert,
            email_confirmed: undefined,
            last_sign_in: undefined
          }
        })
      )

      setExperts(expertsWithAuthData)
    } catch (err) {
      console.error('Error fetching experts:', err)
      setError('Failed to fetch experts')
    }
  }

  const handleCreateExpert = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No valid session found')
      }

      // Call the API route to create expert
      const response = await fetch('/api/admin/create-expert', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create expert')
      }

      // Show appropriate success message based on email verification requirement
      if (result.emailVerificationRequired) {
        setSuccess(result.message || `Expert account created successfully! Verification email sent to ${formData.email}. The expert must verify their email before they can sign in.`)
      } else {
        setSuccess('Expert account created successfully!')
      }
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        display_name: '',
        bio: '',
        title: '',
        company: '',
        years_of_experience: '',
        expertise_areas: '',
        hourly_rate: '',
        linkedin_url: '',
        github_url: '',
        website_url: ''
      })
    } catch (err) {
      console.error('Error creating expert:', err)
      setError(err instanceof Error ? err.message : 'Failed to create expert account')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExpert = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this expert account?')) return

    try {
      // Delete from auth.users will cascade delete profiles
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) throw error
      
      setSuccess('Expert deleted successfully')
      fetchExperts()
    } catch (err) {
      console.error('Error deleting expert:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete expert')
    }
  }

  const handleResendVerification = async (email: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/admin/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend verification')
      }

      setSuccess(result.message)
      // Refresh experts list to update status
      fetchExperts()
    } catch (err) {
      console.error('Error resending verification:', err)
      setError(err instanceof Error ? err.message : 'Failed to resend verification email')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Admin Dashboard</h1>
        <p className="text-text-light mt-2">Manage experts and view system statistics</p>
      </div>

      <div className="flex space-x-4 mb-6">
        <Button
          variant={activeTab === 'create' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('create')}
        >
          Create Expert
        </Button>
        <Button
          variant={activeTab === 'manage' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('manage')}
        >
          Manage Experts
        </Button>
      </div>

      {success && (
        <div className="mb-6 bg-success-bg border border-green-300 rounded-xl p-4">
          <p className="text-success-text">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-error-bg border border-red-300 rounded-xl p-4">
          <p className="text-error-text">{error}</p>
        </div>
      )}

      {activeTab === 'create' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create New Expert Account</CardTitle>
            <CardDescription>Add a new expert to the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateExpert} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <Input
                  label="Password *"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="Min 6 characters"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
                <Input
                  label="Last Name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>

              <Input
                label="Display Name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="How the name appears to learners"
              />

              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Bio</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-border bg-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  rows={4}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Expert's background and experience"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Senior AI Engineer"
                />
                <Input
                  label="Company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Years of Experience"
                  type="number"
                  value={formData.years_of_experience}
                  onChange={(e) => setFormData({ ...formData, years_of_experience: e.target.value })}
                />
                <Input
                  label="Hourly Rate ($)"
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                />
              </div>

              <Input
                label="Expertise Areas"
                value={formData.expertise_areas}
                onChange={(e) => setFormData({ ...formData, expertise_areas: e.target.value })}
                placeholder="Comma separated: Machine Learning, NLP, Computer Vision"
              />

              <div className="space-y-4">
                <Input
                  label="LinkedIn URL"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                />
                <Input
                  label="GitHub URL"
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                />
                <Input
                  label="Website URL"
                  type="url"
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                />
              </div>

              <Button type="submit" loading={loading} className="w-full">
                Create Expert Account
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-4">
          {experts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-text-light">No experts found</p>
              </CardContent>
            </Card>
          ) : (
            experts.map((expert) => (
              <Card key={expert.id}>
                <CardContent className="flex justify-between items-start p-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">
                        {expert.display_name || expert.email}
                      </h3>
                      {expert.expert_profile?.[0]?.is_available && (
                        <Badge className="bg-green-100 text-green-800">Available</Badge>
                      )}
                      {expert.email_confirmed === true ? (
                        <Badge className="bg-blue-100 text-blue-800">Email Verified</Badge>
                      ) : expert.email_confirmed === false ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Pending Verification</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Status Unknown</Badge>
                      )}
                    </div>
                    <p className="text-text-light">{expert.email}</p>
                    {expert.expert_profile?.[0] && (
                      <div className="mt-3 space-y-1">
                        {expert.expert_profile[0].title && (
                          <p className="text-sm">
                            <span className="font-medium">Title:</span> {expert.expert_profile[0].title}
                          </p>
                        )}
                        {expert.expert_profile[0].company && (
                          <p className="text-sm">
                            <span className="font-medium">Company:</span> {expert.expert_profile[0].company}
                          </p>
                        )}
                        {expert.expert_profile[0].hourly_rate && (
                          <p className="text-sm">
                            <span className="font-medium">Rate:</span> ${expert.expert_profile[0].hourly_rate}/hr
                          </p>
                        )}
                        {expert.expert_profile[0].expertise_areas && expert.expert_profile[0].expertise_areas.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {expert.expert_profile[0].expertise_areas.map((area, idx) => (
                              <Badge key={idx} className="bg-primary/10 text-primary">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {expert.email_confirmed === false && (
                      <Button
                        variant="secondary"
                        onClick={() => handleResendVerification(expert.email)}
                      >
                        Resend Verification
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteExpert(expert.user_id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}