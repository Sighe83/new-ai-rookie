import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { UpdateAvailabilityWindowRequest } from '@/types/availability'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Trust RLS to handle authorization - just fetch the window
    const { data: window, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching availability window:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Availability window not found' }, { status: 404 })
      }
      // RLS will return error if unauthorized
      return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 })
    }

    return NextResponse.json({ window })

  } catch (error) {
    console.error('Availability window GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: UpdateAvailabilityWindowRequest = await request.json()
    const { start_at, end_at, is_closed, notes } = body

    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing window for validation purposes only
    const { data: existingWindow, error: fetchError } = await supabase
      .from('availability_windows')
      .select('start_at, end_at')
      .eq('id', id)
      .single()

    if (fetchError || !existingWindow) {
      return NextResponse.json({ error: 'Availability window not found' }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, string | boolean | null> = {}
    
    if (start_at !== undefined) {
      const startDate = new Date(start_at)
      
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 })
      }

      // Check 15-minute alignment
      if (startDate.getMinutes() % 15 !== 0 || startDate.getSeconds() !== 0) {
        return NextResponse.json({ error: 'Start time must be aligned to 15-minute boundaries' }, { status: 400 })
      }

      // Check lead time (at least 1 hour from now)
      const now = new Date()
      const minStartTime = new Date(now.getTime() + 60 * 60 * 1000)
      if (startDate < minStartTime) {
        return NextResponse.json({ error: 'Availability window must start at least 1 hour in the future' }, { status: 400 })
      }

      updateData.start_at = start_at
    }

    if (end_at !== undefined) {
      const endDate = new Date(end_at)
      
      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 })
      }

      // Check 15-minute alignment
      if (endDate.getMinutes() % 15 !== 0 || endDate.getSeconds() !== 0) {
        return NextResponse.json({ error: 'End time must be aligned to 15-minute boundaries' }, { status: 400 })
      }

      updateData.end_at = end_at
    }

    // Validate duration if both times are being updated or provided
    if ((start_at !== undefined && end_at !== undefined) || 
        (start_at !== undefined && !end_at) || 
        (!start_at && end_at !== undefined)) {
      
      const startTime = start_at ? new Date(start_at) : new Date(existingWindow.start_at)
      const endTime = end_at ? new Date(end_at) : new Date(existingWindow.end_at)

      if (startTime >= endTime) {
        return NextResponse.json({ error: 'Start time must be before end time' }, { status: 400 })
      }

      // Check duration constraints
      const durationMs = endTime.getTime() - startTime.getTime()
      if (durationMs < 15 * 60 * 1000) {
        return NextResponse.json({ error: 'Minimum duration is 15 minutes' }, { status: 400 })
      }

      if (durationMs > 8 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Maximum duration is 8 hours' }, { status: 400 })
      }
    }

    if (is_closed !== undefined) {
      updateData.is_closed = is_closed
    }

    if (notes !== undefined) {
      updateData.notes = notes || null
    }

    // Perform the update - RLS will handle authorization
    const { data: updatedWindow, error: updateError } = await supabase
      .from('availability_windows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating availability window:', updateError)
      // Check if it's an RLS error
      if (updateError.code === 'PGRST301' || updateError.message?.includes('security')) {
        return NextResponse.json({ error: 'Unauthorized to update this window' }, { status: 403 })
      }
      return NextResponse.json({ error: updateError.message || 'Failed to update availability window' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Availability window updated successfully',
      window: updatedWindow 
    })

  } catch (error) {
    console.error('Availability window PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if there are any confirmed bookings for this availability window
    const { data: existingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('availability_window_id', id)
      .in('status', ['confirmed', 'pending'])

    if (bookingsError) {
      console.error('Error checking existing bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to check existing bookings' }, { status: 500 })
    }

    if (existingBookings && existingBookings.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete availability window with confirmed or pending bookings. Please cancel the bookings first.' 
      }, { status: 409 })
    }

    // Delete the availability window - RLS will handle authorization
    const { error: deleteError } = await supabase
      .from('availability_windows')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting availability window:', deleteError)
      // Check if it's an RLS error
      if (deleteError.code === 'PGRST301' || deleteError.message?.includes('security')) {
        return NextResponse.json({ error: 'Unauthorized to delete this window' }, { status: 403 })
      }
      if (deleteError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Availability window not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to delete availability window' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Availability window deleted successfully' })

  } catch (error) {
    console.error('Availability window DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}