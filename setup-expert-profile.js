#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Read environment variables from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key] = value.replace(/"/g, '')
  }
})

const supabase = createClient(
  envVars.SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

async function setupExpertProfile() {
  try {
    // Get the expert user
    const { data: expertAuth } = await supabase.auth.admin.listUsers()
    const expertUser = expertAuth.users.find(u => u.email === 'test.expert@example.com')
    
    if (!expertUser) {
      console.error('Expert user not found')
      return
    }

    console.log('Found expert user:', expertUser.id)

    // Create user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: expertUser.id,
        email: expertUser.email,
        first_name: 'Test',
        last_name: 'Expert',
        display_name: 'Test Expert - E2E Testing',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        role: 'expert'
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return
    }

    console.log('✅ User profile created/updated')

    // Create expert profile
    const { data: expertProfile, error: expertError } = await supabase
      .from('expert_profiles')
      .upsert({
        user_profile_id: userProfile.id,
        expertise_areas: ['JavaScript', 'Node.js', 'API Testing', 'E2E Testing'],
        bio: 'Test expert for E2E API testing. Specializes in comprehensive testing workflows.',
        hourly_rate: 45.00,
        is_verified: true,
        rating: 4.8,
        total_sessions: 5
      })
      .select()
      .single()

    if (expertError) {
      console.error('Error creating expert profile:', expertError)
      return
    }

    console.log('✅ Expert profile created/updated:', expertProfile.id)

    // Create a test expert session
    const { data: session, error: sessionError } = await supabase
      .from('expert_sessions')
      .upsert({
        expert_id: expertProfile.id,
        title: 'E2E API Testing Session',
        short_description: 'Comprehensive testing of API endpoints and workflows',
        topic_tags: ['API Testing', 'E2E Testing', 'JavaScript', 'Automation'],
        duration_minutes: 60,
        price_amount: 4500,
        currency: 'USD',
        level: 'INTERMEDIATE',
        is_active: true
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating expert session:', sessionError)
      return
    }

    console.log('✅ Expert session created:', session.id)

    console.log('\n=== Expert Setup Complete ===')
    console.log('Expert ID:', expertProfile.id)
    console.log('Session ID:', session.id)
    console.log('Ready for E2E testing!')

  } catch (error) {
    console.error('Setup error:', error)
  }
}

setupExpertProfile()