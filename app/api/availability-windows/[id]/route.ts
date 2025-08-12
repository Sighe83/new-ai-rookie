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
      return NextResponse.json({ error: 'Availability window not found' }, { status: 404 })
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

    // Get user's expert profile
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
      return NextResponse.json({ error: 'Expert profile not found' }, { status: 404 })
    }

    // Verify the availability window belongs to this expert
    const { data: existingWindow, error: fetchError } = await supabase
      .from('availability_windows')
      .select('expert_id, start_at')
      .eq('id', id)
      .single()

    if (fetchError || !existingWindow) {
      return NextResponse.json({ error: 'Availability window not found' }, { status: 404 })
    }

    if (existingWindow.expert_id !== expertProfile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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
      let endTime = end_at ? new Date(end_at) : new Date()
      
      if (start_at !== undefined && end_at === undefined) {
        // If only updating start_at, we need to get the current end_at
        const { data: currentWindow } = await supabase
          .from('availability_windows')
          .select('end_at')
          .eq('id', id)
          .single()
        if (currentWindow) {
          endTime = new Date(currentWindow.end_at)
        }
      } else if (end_at !== undefined && start_at === undefined) {
        // If only updating end_at, start_at is from existing window
        endTime = new Date(end_at)
      }

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

    // Perform the update
    const { data: updatedWindow, error: updateError } = await supabase
      .from('availability_windows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating availability window:', updateError)
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

    // Get user's expert profile
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
      return NextResponse.json({ error: 'Expert profile not found' }, { status: 404 })
    }

    // Verify the availability window belongs to this expert
    const { data: existingWindow, error: fetchError } = await supabase
      .from('availability_windows')
      .select('expert_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingWindow) {
      return NextResponse.json({ error: 'Availability window not found' }, { status: 404 })
    }

    if (existingWindow.expert_id !== expertProfile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // TODO: In future, check if there are any confirmed bookings that would be affected
    // For now, we'll allow deletion but this should be prevented if bookings exist

    // Delete the availability window
    const { error: deleteError } = await supabase
      .from('availability_windows')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting availability window:', deleteError)
      return NextResponse.json({ error: 'Failed to delete availability window' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Availability window deleted successfully' })

  } catch (error) {
    console.error('Availability window DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}