import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSideClient } from '@/lib/supabase-server'

// Server-side Supabase client with service role
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Verify the requesting user is admin
    const supabase = await createServerSideClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileData?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // First get the user by email to get their ID
    const { data: userData, error: fetchError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 400 })
    }

    const targetUser = userData.users.find(user => user.email === email)
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // For resending verification, we need to use inviteUserByEmail with the existing user
    const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: targetUser.user_metadata
    })

    if (resendError) {
      return NextResponse.json({ error: resendError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Verification email resent to ${email}`
    })

  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}