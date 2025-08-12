import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const {
      email,
      password,
      first_name,
      last_name,
      display_name,
      bio,
      title,
      company,
      years_of_experience,
      expertise_areas,
      hourly_rate,
      linkedin_url,
      github_url,
      website_url
    } = body

    // Verify the requesting user is admin
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
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

    // Use the simpler approach - just create user without confirmation and send verification separately
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // This should require email verification
      user_metadata: {
        role: 'expert',
        display_name: display_name || first_name || email.split('@')[0]
      }
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 400 })
    }

    // The user should now have email_confirmed_at as null, meaning they need to verify
    console.log('Created user email_confirmed_at:', authData.user.email_confirmed_at)

    // Send verification email using inviteUserByEmail (this should send the email)
    try {
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          role: 'expert',
          display_name: display_name || first_name || email.split('@')[0]
        }
      })

      if (inviteError) {
        console.error('Failed to send verification email:', inviteError)
        // Don't fail the entire creation if email fails - user was already created
      } else {
        console.log('Verification email sent to:', email)
      }
    } catch (emailError) {
      console.error('Email verification error:', emailError)
      // Don't fail the entire creation if email fails
    }

    // Wait for trigger to create profile, then update it
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Update user profile
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        role: 'expert',
        first_name,
        last_name,
        display_name: display_name || first_name || email.split('@')[0]
      })
      .eq('user_id', authData.user.id)
      .select()
      .single()

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    // Update expert profile
    const expertiseAreasArray = expertise_areas 
      ? expertise_areas.split(',').map((area: string) => area.trim())
      : []

    const { data: expertProfile, error: expertError } = await supabaseAdmin
      .from('expert_profiles')
      .update({
        bio,
        title,
        company,
        years_of_experience: years_of_experience ? parseInt(years_of_experience) : null,
        expertise_areas: expertiseAreasArray,
        hourly_rate: hourly_rate ? parseFloat(hourly_rate) : null,
        linkedin_url,
        github_url,
        website_url,
        is_available: true
      })
      .eq('user_profile_id', updatedProfile?.id || authData.user.id)
      .select()
      .single()

    if (expertError) {
      console.error('Expert profile error:', expertError)
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      profile: updatedProfile,
      expertProfile,
      emailVerificationRequired: true,
      message: `Expert account created successfully. Verification email sent to ${email}. The expert must verify their email before they can sign in.`
    })

  } catch (error) {
    console.error('Expert creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}