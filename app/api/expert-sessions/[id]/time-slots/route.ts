import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') // YYYY-MM-DD
    const endDate = searchParams.get('end_date') // YYYY-MM-DD (optional, defaults to 7 days from start)
    
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required parameters
    if (!startDate) {
      return NextResponse.json({ error: 'start_date parameter is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const start = new Date(startDate + 'T00:00:00Z')
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid start_date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    // Default end date to 7 days from start if not provided
    const end = endDate 
      ? new Date(endDate + 'T23:59:59Z')
      : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)

    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid end_date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json({ error: 'end_date must be after start_date' }, { status: 400 })
    }

    // Get the expert session to validate it exists and get duration
    const { data: session, error: sessionError } = await supabase
      .from('expert_sessions')
      .select('id, expert_id, duration_minutes, title')
      .eq('id', params.id)
      .eq('is_active', true)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
    }

    // Note: Using pre-created slots instead of availability windows

    // Use pre-created slots from the slots table instead of generating them dynamically
    const { data: timeSlots, error: slotsError } = await supabase
      .from('slots')
      .select('id, start_time, end_time, is_available, max_bookings, current_bookings')
      .eq('expert_session_id', params.id)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true })

    if (slotsError) {
      console.error('Error fetching slots:', slotsError)
      return NextResponse.json({ error: 'Failed to fetch time slots' }, { status: 500 })
    }

    // Transform slots to match the expected format
    const formattedSlots = (timeSlots || []).map(slot => ({
      id: slot.id,
      start_at: slot.start_time,
      end_at: slot.end_time,
      is_available: slot.is_available && slot.current_bookings < slot.max_bookings,
      session_duration_minutes: session.duration_minutes,
      bookings_remaining: slot.max_bookings - slot.current_bookings,
    }))

    // Apply business rules filtering
    const now = new Date()
    const minStartTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours minimum lead time
    
    const availableSlots = formattedSlots.filter(slot => {
      const slotStart = new Date(slot.start_at)
      return slotStart > minStartTime // Only show slots that meet minimum lead time
    })

    // Limit results to avoid huge responses (max 200 slots)
    const limitedSlots = availableSlots.slice(0, 200)

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        duration_minutes: session.duration_minutes,
      },
      date_range: {
        start_date: startDate,
        end_date: endDate || new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      time_slots: limitedSlots,
      availability_summary: {
        total_slots: limitedSlots.length,
        available_slots: limitedSlots.filter(slot => slot.is_available).length,
        unavailable_slots: limitedSlots.filter(slot => !slot.is_available).length,
      },
      constraints: {
        min_lead_time_hours: 2,
        slot_increment_minutes: 15,
      }
    })

  } catch (error) {
    console.error('Time slots GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}