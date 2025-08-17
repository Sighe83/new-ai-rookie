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
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function getAuthToken() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test.learner@example.com',
      password: 'password123'
    })
    
    if (error) {
      console.error('Auth error:', error)
      return
    }
    
    console.log(data.session.access_token)
  } catch (error) {
    console.error('Script error:', error)
  }
}

getAuthToken()