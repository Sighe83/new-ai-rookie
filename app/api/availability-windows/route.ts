import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { CreateAvailabilityWindowRequest } from '@/types/availability'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const expertId = searchParams.get('expert_id')
    const includeAll = searchParams.get('include_all') === 'true'
    
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('availability_windows')
      .select(`
        id,
        expert_id,
        start_at,
        end_at,
        is_closed,
        notes,
        created_at,
        updated_at,
        expert_profiles!inner(
          id,
          user_profiles!inner(
            display_name,
            first_name,
            last_name
          )
        )
      `)

    // Filter by expert if specified
    if (expertId) {
      query = query.eq('expert_id', expertId)
    }

    // Default to showing only future, open windows unless includeAll is true
    if (!includeAll) {
      query = query
        .eq('is_closed', false)
        .gte('start_at', new Date().toISOString())
    }

    // Order by start time
    query = query.order('start_at', { ascending: true })

    const { data: windows, error } = await query

    if (error) {
      console.error('Error fetching availability windows:', error)
      return NextResponse.json({ error: 'Failed to fetch availability windows' }, { status: 500 })
    }

    return NextResponse.json({ windows })

  } catch (error) {
    console.error('Availability windows GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateAvailabilityWindowRequest = await request.json()
    const { start_at, end_at, notes } = body

    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's expert profile ID for the insert
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const { data: expertProfile } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single()

    if (!expertProfile) {
      return NextResponse.json({ error: 'Expert profile not found. Only experts can create availability windows.' }, { status: 403 })
    }

    // Validate time format and alignment
    const startDate = new Date(start_at)
    const endDate = new Date(end_at)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (startDate >= endDate) {
      return NextResponse.json({ error: 'Start time must be before end time' }, { status: 400 })
    }

    // Check 15-minute alignment
    if (startDate.getMinutes() % 15 !== 0 || startDate.getSeconds() !== 0) {
      return NextResponse.json({ error: 'Start time must be aligned to 15-minute boundaries' }, { status: 400 })
    }

    if (endDate.getMinutes() % 15 !== 0 || endDate.getSeconds() !== 0) {
      return NextResponse.json({ error: 'End time must be aligned to 15-minute boundaries' }, { status: 400 })
    }

    // Check minimum duration (15 minutes)
    const durationMs = endDate.getTime() - startDate.getTime()
    if (durationMs < 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Minimum duration is 15 minutes' }, { status: 400 })
    }

    // Check maximum duration (8 hours)
    if (durationMs > 8 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Maximum duration is 8 hours' }, { status: 400 })
    }

    // Check lead time (at least 1 hour from now)
    const now = new Date()
    const minStartTime = new Date(now.getTime() + 60 * 60 * 1000)
    if (startDate < minStartTime) {
      return NextResponse.json({ error: 'Availability window must start at least 1 hour in the future' }, { status: 400 })
    }

    // Check maximum future time (180 days)
    const maxStartTime = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
    if (startDate > maxStartTime) {
      return NextResponse.json({ error: 'Availability window cannot be more than 180 days in the future' }, { status: 400 })
    }

    // Create the availability window - RLS will verify the user owns this expert profile
    const { data: newWindow, error: createError } = await supabase
      .from('availability_windows')
      .insert({
        expert_id: expertProfile.id,
        start_at: start_at,
        end_at: end_at,
        notes: notes || null,
        is_closed: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating availability window:', createError)
      // Check for RLS errors
      if (createError.code === 'PGRST301' || createError.message?.includes('security')) {
        return NextResponse.json({ error: 'Unauthorized to create availability window' }, { status: 403 })
      }
      // Check for overlap or validation errors from database triggers
      if (createError.message?.includes('overlap')) {
        return NextResponse.json({ error: 'Availability window overlaps with existing window' }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message || 'Failed to create availability window' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Availability window created successfully',
      window: newWindow 
    }, { status: 201 })

  } catch (error) {
    console.error('Availability windows POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}