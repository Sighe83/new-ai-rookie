import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = await request.json()
    const userRole = role || user.user_metadata?.role || 'learner'

    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json({ message: 'Profile already exists' }, { status: 200 })
    }

    // Create user profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        email: user.email,
        display_name: userRole.charAt(0).toUpperCase() + userRole.slice(1) + ' User',
        first_name: userRole.charAt(0).toUpperCase() + userRole.slice(1),
        last_name: 'User',
        role: userRole === 'AI_EXPERT' ? 'expert' : userRole
      })
      .select()
      .single()

    if (userProfileError || !userProfile) {
      console.error('Failed to create user profile:', userProfileError)
      return NextResponse.json({ 
        error: 'Failed to create user profile',
        details: userProfileError?.message
      }, { status: 500 })
    }

    // Create role-specific profile
    if (userRole === 'learner') {
      const { error: learnerError } = await supabase
        .from('learner_profiles')
        .insert({
          user_profile_id: userProfile.id,
          learning_goals: 'Learn AI basics',
          level: 'BEGINNER'
        })

      if (learnerError) {
        console.error('Failed to create learner profile:', learnerError)
        return NextResponse.json({ 
          error: 'Failed to create learner profile',
          details: learnerError.message
        }, { status: 500 })
      }
    } else if (userRole === 'AI_EXPERT' || userRole === 'expert') {
      const { error: expertError } = await supabase
        .from('expert_profiles')
        .insert({
          user_profile_id: userProfile.id,
          bio: 'Experienced AI professional ready to help learners.',
          specialties: [],
          is_available: true
        })

      if (expertError) {
        console.error('Failed to create expert profile:', expertError)
        return NextResponse.json({ 
          error: 'Failed to create expert profile',
          details: expertError.message
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      message: 'Profile created successfully',
      userProfile 
    }, { status: 201 })

  } catch (error) {
    console.error('Profile creation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}