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

    // Get availability windows for the expert in the date range
    const { data: availabilityWindows, error: availabilityError } = await supabase
      .from('availability_windows')
      .select('id, start_at, end_at, is_closed')
      .eq('expert_id', session.expert_id)
      .eq('is_closed', false)
      .gte('start_at', start.toISOString())
      .lte('end_at', end.toISOString())
      .order('start_at', { ascending: true })

    if (availabilityError) {
      console.error('Error fetching availability windows:', availabilityError)
      return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
    }

    // Get existing bookings for this expert in the date range that would conflict
    const { data: existingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_at, end_at')
      .eq('expert_id', session.expert_id)
      .in('status', ['pending', 'awaiting_confirmation', 'confirmed'])
      .gte('start_at', start.toISOString())
      .lte('end_at', end.toISOString())

    if (bookingsError) {
      console.error('Error fetching existing bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Generate time slots
    const timeSlots = []
    const sessionDurationMs = session.duration_minutes * 60 * 1000
    const slotIncrementMs = 15 * 60 * 1000 // 15-minute increments
    
    // Business rules
    const minLeadTimeMs = 2 * 60 * 60 * 1000 // 2 hours minimum lead time
    const maxFutureDays = 90 // 90 days maximum booking horizon
    const now = new Date()
    const minStartTime = new Date(now.getTime() + minLeadTimeMs)
    const maxEndTime = new Date(now.getTime() + maxFutureDays * 24 * 60 * 60 * 1000)

    // Process each availability window
    for (const window of availabilityWindows || []) {
      const windowStart = new Date(window.start_at)
      const windowEnd = new Date(window.end_at)

      // Ensure window is within our booking constraints
      const effectiveStart = new Date(Math.max(windowStart.getTime(), minStartTime.getTime()))
      const effectiveEnd = new Date(Math.min(windowEnd.getTime(), maxEndTime.getTime()))

      // Skip if effective window is too small for session
      if (effectiveEnd.getTime() - effectiveStart.getTime() < sessionDurationMs) {
        continue
      }

      // Align start time to 15-minute boundary
      const alignedStartMs = Math.ceil(effectiveStart.getTime() / slotIncrementMs) * slotIncrementMs
      const alignedStart = new Date(alignedStartMs)

      // Generate slots within this window
      let slotStart = alignedStart
      
      while (slotStart.getTime() + sessionDurationMs <= effectiveEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + sessionDurationMs)

        // Check if this slot conflicts with existing bookings
        const hasConflict = existingBookings?.some(booking => {
          const bookingStart = new Date(booking.start_at)
          const bookingEnd = new Date(booking.end_at)
          
          // Check for any overlap
          return slotStart < bookingEnd && slotEnd > bookingStart
        })

        // Add the slot
        timeSlots.push({
          start_at: slotStart.toISOString(),
          end_at: slotEnd.toISOString(),
          is_available: !hasConflict,
          availability_window_id: window.id,
          session_duration_minutes: session.duration_minutes,
        })

        // Move to next 15-minute increment
        slotStart = new Date(slotStart.getTime() + slotIncrementMs)
      }
    }

    // Sort slots by start time
    timeSlots.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

    // Limit results to avoid huge responses (max 200 slots)
    const limitedSlots = timeSlots.slice(0, 200)

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
        max_booking_days_ahead: maxFutureDays,
        slot_increment_minutes: 15,
      }
    })

  } catch (error) {
    console.error('Time slots GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}