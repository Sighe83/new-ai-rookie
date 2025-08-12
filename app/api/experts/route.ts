import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with service role for this specific endpoint
    // This bypasses RLS for public expert browsing
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get all experts with their profiles and active sessions
    const { data: experts, error: expertsError } = await supabaseAdmin
      .from('expert_profiles')
      .select(`
        id,
        expertise_areas,
        bio,
        hourly_rate,
        rating,
        total_sessions,
        user_profiles!inner(
          user_id,
          display_name,
          avatar_url
        )
      `)
      .eq('is_available', true)

    if (expertsError) {
      console.error('Error fetching experts:', expertsError)
      return NextResponse.json(
        { error: 'Failed to fetch experts', details: expertsError },
        { status: 500 }
      )
    }

    console.log('Experts fetched:', experts?.length || 0)

    // Get active sessions for all experts
    const { data: sessions, error: sessionsError } = await supabaseAdmin
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
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: sessionsError },
        { status: 500 }
      )
    }

    console.log('Sessions fetched:', sessions?.length || 0)

    // Group sessions by expert_id
    const sessionsByExpert = sessions?.reduce((acc, session) => {
      if (!acc[session.expert_id]) {
        acc[session.expert_id] = []
      }
      acc[session.expert_id].push(session)
      return acc
    }, {} as Record<string, typeof sessions>) || {}

    // Combine experts with their sessions
    const expertsWithSessions = experts?.map(expert => ({
      ...expert,
      sessions: sessionsByExpert[expert.id] || []
    })) || []

    return NextResponse.json({
      experts: expertsWithSessions,
      total: expertsWithSessions.length
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}