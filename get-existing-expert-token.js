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

async function getExistingExpertToken() {
  try {
    // Get the expert profile
    const { data: expertProfile } = await supabase
      .from('expert_profiles')
      .select('user_profiles(user_id, email)')
      .eq('id', 'f3656214-310f-43c9-a092-28a4c65c7ba8')
      .single()
    
    if (!expertProfile) {
      console.error('Expert profile not found')
      return
    }

    const userId = expertProfile.user_profiles.user_id
    
    // Generate a token for this user
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: expertProfile.user_profiles.email,
      options: {
        redirectTo: 'http://localhost:3002'
      }
    })
    
    if (error) {
      console.error('Error generating token:', error)
      return
    }
    
    // Extract the access token from the URL
    const url = new URL(data.properties.action_link)
    const token = url.searchParams.get('access_token')
    
    console.log(token)
    
  } catch (error) {
    console.error('Script error:', error)
  }
}

getExistingExpertToken()