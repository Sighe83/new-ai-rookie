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

async function createTestUsers() {
  console.log('Creating test users...')
  
  // Create a test learner
  const testLearner = {
    email: 'test.learner@example.com',
    password: 'password123',
    options: {
      data: {
        role: 'learner'
      },
      emailRedirectTo: undefined // Skip email confirmation
    }
  }
  
  // Create a test expert  
  const testExpert = {
    email: 'test.expert@example.com', 
    password: 'password123',
    options: {
      data: {
        role: 'expert'
      },
      emailRedirectTo: undefined // Skip email confirmation
    }
  }
  
  try {
    // Create learner
    console.log('Creating test learner...')
    const { data: learnerData, error: learnerError } = await supabase.auth.admin.createUser(testLearner)
    if (learnerError) {
      console.error('Learner creation error:', learnerError)
    } else {
      console.log('✅ Test learner created:', testLearner.email)
      
      // Manually confirm the learner's email
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        learnerData.user.id,
        { email_confirm: true }
      )
      if (confirmError) {
        console.error('Error confirming learner email:', confirmError)
      } else {
        console.log('✅ Learner email confirmed')
      }
    }
    
    // Create expert
    console.log('Creating test expert...')
    const { data: expertData, error: expertError } = await supabase.auth.admin.createUser(testExpert)
    if (expertError) {
      console.error('Expert creation error:', expertError)
    } else {
      console.log('✅ Test expert created:', testExpert.email)
      
      // Manually confirm the expert's email
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        expertData.user.id,
        { email_confirm: true }
      )
      if (confirmError) {
        console.error('Error confirming expert email:', confirmError)
      } else {
        console.log('✅ Expert email confirmed')
      }
    }
    
    console.log('\n=== Test Accounts Created ===')
    console.log('Learner: test.learner@example.com / password123')
    console.log('Expert: test.expert@example.com / password123')
    console.log('=============================\n')
    
  } catch (error) {
    console.error('Script error:', error)
  }
}

createTestUsers()