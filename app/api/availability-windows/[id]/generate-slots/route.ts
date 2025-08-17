import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const supabase = await createServerSideClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's expert profile to verify ownership
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
      return NextResponse.json({ error: 'Only experts can generate slots' }, { status: 403 })
    }

    // Verify the availability window belongs to this expert
    const { data: availabilityWindow, error: windowError } = await supabase
      .from('availability_windows')
      .select('id, expert_id, start_at, end_at, is_closed')
      .eq('id', params.id)
      .eq('expert_id', expertProfile.id)
      .single()

    if (windowError || !availabilityWindow) {
      return NextResponse.json({ error: 'Availability window not found or unauthorized' }, { status: 404 })
    }

    if (availabilityWindow.is_closed) {
      return NextResponse.json({ error: 'Cannot generate slots for closed availability window' }, { status: 400 })
    }

    // Call the database function to generate slots for all sessions
    const { data: results, error: generateError } = await supabase
      .rpc('generate_all_slots_for_availability_window', {
        p_availability_window_id: params.id
      })

    if (generateError) {
      console.error('Error generating slots:', generateError)
      return NextResponse.json({ 
        error: generateError.message || 'Failed to generate slots' 
      }, { status: 500 })
    }

    // Calculate total slots created
    const totalSlots = results?.reduce((sum: number, r: any) => sum + (r.slots_created || 0), 0) || 0

    // Get the actual generated slots for verification
    const { data: generatedSlots, error: slotsError } = await supabase
      .from('bookable_slots')
      .select('id, session_id, start_time, end_time')
      .eq('availability_window_id', params.id)
      .order('start_time', { ascending: true })

    if (slotsError) {
      console.error('Error fetching generated slots:', slotsError)
    }

    return NextResponse.json({
      message: 'Slots generated successfully',
      availability_window_id: params.id,
      sessions_processed: results?.length || 0,
      total_slots_created: totalSlots,
      slot_details: results,
      generated_slots: generatedSlots || []
    }, { status: 201 })

  } catch (error) {
    console.error('Generate slots error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check existing slots for an availability window
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const supabase = await createServerSideClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get slots for this availability window
    const { data: slots, error: slotsError } = await supabase
      .from('bookable_slots')
      .select(`
        id,
        session_id,
        start_time,
        end_time,
        is_available,
        max_bookings,
        current_bookings,
        sessions!inner(
          id,
          title,
          duration_minutes
        )
      `)
      .eq('availability_window_id', params.id)
      .order('start_time', { ascending: true })

    if (slotsError) {
      console.error('Error fetching slots:', slotsError)
      return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 })
    }

    // Group slots by session
    const slotsBySession = slots?.reduce((acc: any, slot: any) => {
      const sessionId = slot.session_id
      if (!acc[sessionId]) {
        acc[sessionId] = {
          session: slot.sessions,
          slots: []
        }
      }
      acc[sessionId].slots.push({
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
        bookings: `${slot.current_bookings}/${slot.max_bookings}`
      })
      return acc
    }, {}) || {}

    return NextResponse.json({
      availability_window_id: params.id,
      total_slots: slots?.length || 0,
      available_slots: slots?.filter(s => s.is_available).length || 0,
      slots_by_session: slotsBySession
    })

  } catch (error) {
    console.error('Get slots error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
