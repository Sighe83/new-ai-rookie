import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's learner profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: learnerProfile, error: learnerError } = await supabase
      .from('learner_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    if (learnerError || !learnerProfile) {
      return NextResponse.json({ error: 'Learner profile not found' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 items
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // Optional status filter
    const includeCompleted = searchParams.get('include_completed') === 'true';

    // Build query with all required fields
    let query = supabase
      .from('bookings')
      .select(`
        id,
        status,
        payment_status,
        start_at,
        end_at,
        created_at,
        updated_at,
        amount_authorized,
        currency,
        learner_notes,
        expert_notes,
        declined_reason,
        approved_at,
        declined_at,
        session_id,
        sessions(
          id,
          title,
          description,
          duration_minutes,
          price_cents,
          topic_tags,
          level
        ),
        expert_profiles!bookings_expert_id_fkey(
          id,
          bio,
          rating,
          user_profiles(
            id,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('learner_id', learnerProfile.id);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    } else if (!includeCompleted) {
      // By default, exclude completed bookings unless explicitly requested
      query = query.neq('status', 'completed');
    }

    // Execute query
    const { data: bookings, error: bookingsError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (bookingsError) {
      console.error('Error fetching learner bookings:', bookingsError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('learner_id', learnerProfile.id);

    if (status) {
      countQuery = countQuery.eq('status', status);
    } else if (!includeCompleted) {
      countQuery = countQuery.neq('status', 'completed');
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error getting bookings count:', countError);
      return NextResponse.json(
        { error: 'Failed to get booking count' },
        { status: 500 }
      );
    }

    // Transform data for frontend consumption
    const myBookings = bookings?.map(booking => ({
      id: booking.id,
      status: booking.status,
      payment_status: booking.payment_status,
      start_at: booking.start_at,
      end_at: booking.end_at,
      created_at: booking.created_at,
      updated_at: booking.updated_at,
      amount_authorized: booking.amount_authorized,
      currency: booking.currency,
      learner_notes: booking.learner_notes,
      expert_notes: booking.expert_notes,
      declined_reason: booking.declined_reason,
      approved_at: booking.approved_at,
      declined_at: booking.declined_at,
      
      // Session information
      session: {
        id: booking.sessions?.id,
        title: booking.sessions?.title,
        description: booking.sessions?.description,
        duration_minutes: booking.sessions?.duration_minutes,
        price_cents: booking.sessions?.price_cents,
        topic_tags: booking.sessions?.topic_tags,
        level: booking.sessions?.level
      },
      
      // Expert information  
      expert: {
        id: booking.expert_profiles?.id,
        display_name: booking.expert_profiles?.user_profiles?.display_name,
        avatar_url: booking.expert_profiles?.user_profiles?.avatar_url,
        bio: booking.expert_profiles?.bio,
        rating: booking.expert_profiles?.rating
      },
      
      // Helper fields
      status_display: getStatusDisplayInfo(booking.status, booking.payment_status),
      time_until_session: getTimeUntilSession(booking.start_at),
      can_cancel: canCancelBooking(booking.status, booking.start_at),
      next_action: getNextAction(booking.status, booking.payment_status, booking.start_at)
    })) || [];

    // Get status summary
    const statusSummary = await getBookingStatusSummary(supabase, learnerProfile.id);

    return NextResponse.json({
      bookings: myBookings,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      },
      summary: statusSummary
    });

  } catch (error) {
    console.error('Error in my bookings endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getStatusDisplayInfo(status: string, paymentStatus: string) {
  const statusMap: Record<string, { label: string; color: string; description: string }> = {
    'pending': {
      label: 'Pending Payment',
      color: 'yellow',
      description: 'Waiting for payment to be processed'
    },
    'pending_approval': {
      label: 'Awaiting Expert Approval',
      color: 'blue',
      description: 'Your payment is authorized. The expert is reviewing your booking request.'
    },
    'confirmed': {
      label: 'Confirmed',
      color: 'green',
      description: 'Your booking has been approved and payment has been captured'
    },
    'declined': {
      label: 'Declined',
      color: 'red',
      description: 'The expert declined your booking request. Payment has been refunded.'
    },
    'cancelled': {
      label: 'Cancelled',
      color: 'gray',
      description: 'Booking was cancelled'
    },
    'completed': {
      label: 'Completed',
      color: 'gray',
      description: 'Session has been completed'
    },
    'no_show': {
      label: 'No Show',
      color: 'red',
      description: 'You did not attend the scheduled session'
    }
  };

  return statusMap[status] || {
    label: status,
    color: 'gray',
    description: 'Unknown status'
  };
}

function getTimeUntilSession(startAt: string): string | null {
  const now = new Date();
  const start = new Date(startAt);
  const diffMs = start.getTime() - now.getTime();
  
  if (diffMs < 0) {
    return 'Past session';
  }
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
}

function canCancelBooking(status: string, startAt: string): boolean {
  // Can cancel if status allows and session is more than 2 hours away
  const allowedStatuses = ['pending_approval', 'confirmed'];
  if (!allowedStatuses.includes(status)) {
    return false;
  }
  
  const now = new Date();
  const start = new Date(startAt);
  const hoursUntilSession = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return hoursUntilSession > 2; // 2-hour cancellation policy
}

function getNextAction(status: string, paymentStatus: string, startAt: string): string | null {
  const now = new Date();
  const start = new Date(startAt);
  const hoursUntilSession = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  switch (status) {
    case 'pending':
      return 'Complete payment';
    case 'pending_approval':
      return 'Awaiting expert approval';
    case 'confirmed':
      if (hoursUntilSession > 0 && hoursUntilSession < 1) {
        return 'Session starting soon';
      }
      if (hoursUntilSession > 0) {
        return 'Attend session';
      }
      return null;
    case 'declined':
      return 'Book another session';
    default:
      return null;
  }
}

async function getBookingStatusSummary(supabase: any, learnerId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('status')
    .eq('learner_id', learnerId);
    
  if (error) {
    return { total: 0 };
  }
  
  const summary = data.reduce((acc: any, booking: any) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, {});
  
  return summary;
}