#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Read environment variables
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key] = value.replace(/"/g, '')
  }
})

const supabaseAdmin = createClient(
  envVars.SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

async function setupLearnerProfile() {
  try {
    // Get learner user
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const learnerUser = users.users.find(u => u.email === 'test.learner@example.com')
    
    if (!learnerUser) {
      console.error('Learner user not found')
      return
    }

    // Create user profile
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: learnerUser.id,
        email: learnerUser.email,
        first_name: 'Test',
        last_name: 'Learner',
        display_name: 'Test Learner',
        role: 'learner'
      })
      .select()

    if (error) {
      console.error('Error creating profile:', error)
    } else {
      console.log('✅ Learner profile created')
    }

  } catch (error) {
    console.error('Setup error:', error)
  }
}

setupLearnerProfile()