import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { UpdateExpertSessionRequest } from '@/types/expert-sessions'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error } = await supabase
      .from('expert_sessions')
      .select(`
        id,
        expert_id,
        title,
        short_description,
        topic_tags,
        duration_minutes,
        price_amount,
        currency,
        level,
        prerequisites,
        materials_url,
        is_active,
        created_at,
        updated_at,
        expert_profiles!inner(
          id,
          bio,
          rating,
          total_sessions,
          user_profiles!inner(
            display_name,
            first_name,
            last_name
          )
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      console.error('Error fetching expert session:', error)
      return NextResponse.json({ error: 'Failed to fetch expert session' }, { status: 500 })
    }

    // Transform data to match expected format
    const expertProfile = Array.isArray(session.expert_profiles) ? session.expert_profiles[0] : session.expert_profiles
    const userProfile = Array.isArray(expertProfile.user_profiles) ? expertProfile.user_profiles[0] : expertProfile.user_profiles
    
    const transformedSession = {
      ...session,
      expert_display_name: userProfile.display_name,
      expert_bio: expertProfile.bio,
      expert_rating: expertProfile.rating,
      expert_total_sessions: expertProfile.total_sessions,
    }

    return NextResponse.json({ session: transformedSession })

  } catch (error) {
    console.error('Expert session GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const body: UpdateExpertSessionRequest = await request.json()
    
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's expert profile and verify ownership
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const { data: expertProfile, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single()

    if (expertError || !expertProfile) {
      return NextResponse.json({ error: 'Expert profile not found' }, { status: 404 })
    }

    // Check if session exists and user owns it (or is admin)
    const { data: existingSession, error: sessionError } = await supabase
      .from('expert_sessions')
      .select('id, expert_id, price_amount, duration_minutes, currency')
      .eq('id', params.id)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to verify session ownership' }, { status: 500 })
    }

    if (existingSession.expert_id !== expertProfile.id && userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'You can only edit your own sessions' }, { status: 403 })
    }

    // Validate updated fields
    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) {
      if (!body.title?.trim() || body.title.trim().length < 3) {
        return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
      }
      if (body.title.trim().length > 200) {
        return NextResponse.json({ error: 'Title cannot exceed 200 characters' }, { status: 400 })
      }
      updates.title = body.title.trim()
    }

    if (body.short_description !== undefined) {
      if (!body.short_description?.trim() || body.short_description.trim().length < 10) {
        return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
      }
      if (body.short_description.trim().length > 500) {
        return NextResponse.json({ error: 'Description cannot exceed 500 characters' }, { status: 400 })
      }
      updates.short_description = body.short_description.trim()
    }

    if (body.topic_tags !== undefined) {
      if (!body.topic_tags || body.topic_tags.length === 0) {
        return NextResponse.json({ error: 'At least one topic tag is required' }, { status: 400 })
      }
      if (body.topic_tags.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 topic tags allowed' }, { status: 400 })
      }

      // Validate topic tags
      for (const tag of body.topic_tags) {
        if (!tag.trim()) {
          return NextResponse.json({ error: 'Topic tags cannot be empty' }, { status: 400 })
        }
        if (tag.length > 50) {
          return NextResponse.json({ error: 'Topic tags cannot exceed 50 characters' }, { status: 400 })
        }
      }
      updates.topic_tags = body.topic_tags.map(tag => tag.trim()).filter(Boolean)
    }

    if (body.duration_minutes !== undefined) {
      if (!body.duration_minutes || body.duration_minutes % 15 !== 0 || body.duration_minutes < 15 || body.duration_minutes > 480) {
        return NextResponse.json({ error: 'Duration must be a multiple of 15 minutes, between 15 and 480 minutes' }, { status: 400 })
      }
      updates.duration_minutes = body.duration_minutes
    }

    if (body.price_amount !== undefined) {
      if (!body.price_amount || body.price_amount < 0) {
        return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 })
      }
      updates.price_amount = body.price_amount
    }

    if (body.currency !== undefined) {
      if (!['DKK', 'USD', 'EUR'].includes(body.currency)) {
        return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
      }
      updates.currency = body.currency
    }

    // Validate minimum hourly rate for DKK if both price and duration are being updated
    const finalPriceAmount = updates.price_amount || existingSession.price_amount
    const finalDurationMinutes = updates.duration_minutes || existingSession.duration_minutes
    const finalCurrency = updates.currency || existingSession.currency

    if (finalCurrency === 'DKK') {
      const hourlyRate = (finalPriceAmount * 60) / finalDurationMinutes
      if (hourlyRate < 5000) { // 50 DKK/hour in øre
        return NextResponse.json({ error: 'Minimum hourly rate is 50 DKK/hour' }, { status: 400 })
      }
    }

    if (body.level !== undefined) {
      if (body.level !== null && !['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(body.level)) {
        return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
      }
      updates.level = body.level
    }

    if (body.prerequisites !== undefined) {
      updates.prerequisites = body.prerequisites?.trim() || null
    }

    if (body.materials_url !== undefined) {
      if (body.materials_url && !body.materials_url.match(/^https?:\/\/.+/)) {
        return NextResponse.json({ error: 'Materials URL must be a valid HTTP/HTTPS URL' }, { status: 400 })
      }
      updates.materials_url = body.materials_url?.trim() || null
    }

    if (body.is_active !== undefined) {
      updates.is_active = body.is_active
    }

    // If no updates provided
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // Update the session
    const { data: updatedSession, error: updateError } = await supabase
      .from('expert_sessions')
      .update(updates)
      .eq('id', params.id)
      .select(`
        id,
        expert_id,
        title,
        short_description,
        topic_tags,
        duration_minutes,
        price_amount,
        currency,
        level,
        prerequisites,
        materials_url,
        is_active,
        created_at,
        updated_at
      `)
      .single()

    if (updateError) {
      console.error('Error updating expert session:', updateError)
      return NextResponse.json({ error: updateError.message || 'Failed to update expert session' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Expert session updated successfully',
      session: updatedSession 
    })

  } catch (error) {
    console.error('Expert session PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's expert profile and verify ownership
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const { data: expertProfile, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single()

    if (expertError || !expertProfile) {
      return NextResponse.json({ error: 'Expert profile not found' }, { status: 404 })
    }

    // Check if session exists and user owns it (or is admin)
    const { data: existingSession, error: sessionError } = await supabase
      .from('expert_sessions')
      .select('id, expert_id')
      .eq('id', params.id)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to verify session ownership' }, { status: 500 })
    }

    if (existingSession.expert_id !== expertProfile.id && userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'You can only delete your own sessions' }, { status: 403 })
    }

    // Check if there are any active bookings for this session
    const { data: activeBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('expert_session_id', params.id)
      .in('status', ['pending', 'awaiting_confirmation', 'confirmed'])
      .limit(1)

    if (bookingsError) {
      console.error('Error checking for active bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to check for active bookings' }, { status: 500 })
    }

    if (activeBookings && activeBookings.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete session with active bookings. Please cancel or complete all bookings first.' 
      }, { status: 409 })
    }

    // Soft delete - set is_active to false instead of actually deleting
    const { error: deleteError } = await supabase
      .from('expert_sessions')
      .update({ is_active: false })
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting expert session:', deleteError)
      return NextResponse.json({ error: 'Failed to delete expert session' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Expert session deleted successfully' 
    })

  } catch (error) {
    console.error('Expert session DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}