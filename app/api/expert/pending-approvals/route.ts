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

    // Get user's expert profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: expertProfile, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    if (expertError || !expertProfile) {
      return NextResponse.json({ error: 'Expert profile not found' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 items
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || 'pending_approval';

    // Get pending approvals with learner and session details
    const { data: pendingApprovals, error: approvalsError } = await supabase
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
        
        -- Session details
        sessions!inner(
          id,
          title,
          description,
          duration_minutes,
          price_cents,
          topic_tags,
          level
        ),
        
        -- Learner details
        learner_profiles!inner(
          id,
          user_profiles!inner(
            id,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('expert_id', expertProfile.id)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (approvalsError) {
      console.error('Error fetching pending approvals:', approvalsError);
      return NextResponse.json(
        { error: 'Failed to fetch pending approvals' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('expert_id', expertProfile.id)
      .eq('status', status);

    if (countError) {
      console.error('Error getting pending approvals count:', countError);
      return NextResponse.json(
        { error: 'Failed to get approval count' },
        { status: 500 }
      );
    }

    // Transform data for frontend consumption
    const approvals = pendingApprovals?.map(booking => ({
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
      
      // Learner information  
      learner: {
        id: booking.learner_profiles?.id,
        display_name: booking.learner_profiles?.user_profiles?.display_name,
        avatar_url: booking.learner_profiles?.user_profiles?.avatar_url
      },
      
      // Helper fields
      time_since_created: getTimeSinceCreated(booking.created_at),
      expires_at: getExpirationTime(booking.created_at), // 48 hours from creation
      is_urgent: isBookingUrgent(booking.created_at, booking.start_at)
    })) || [];

    return NextResponse.json({
      approvals,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      },
      summary: {
        total_pending: count || 0,
        urgent_count: approvals.filter(a => a.is_urgent).length,
        expiring_soon: approvals.filter(a => isExpiringSoon(a.expires_at)).length
      }
    });

  } catch (error) {
    console.error('Error in pending approvals endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getTimeSinceCreated(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m ago`;
  }
  return `${diffMinutes}m ago`;
}

function getExpirationTime(createdAt: string): string {
  const created = new Date(createdAt);
  const expires = new Date(created.getTime() + 48 * 60 * 60 * 1000); // 48 hours
  return expires.toISOString();
}

function isBookingUrgent(createdAt: string, startAt: string): boolean {
  const created = new Date(createdAt);
  const start = new Date(startAt);
  const now = new Date();
  
  // Urgent if session starts within 24 hours or booking has been pending for over 12 hours
  const hoursUntilSession = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  const hoursPending = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  
  return hoursUntilSession < 24 || hoursPending > 12;
}

function isExpiringSoon(expiresAt: string): boolean {
  const expires = new Date(expiresAt);
  const now = new Date();
  const hoursUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return hoursUntilExpiry < 6; // Expiring within 6 hours
}