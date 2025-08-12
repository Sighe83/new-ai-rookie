const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY // You'll need to add this to .env.local

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  try {
    console.log('Creating admin user...')
    
    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'daniel.elkaer@gmail.com',
      password: 'Mormor7594',
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('User already exists, updating role to admin...')
        
        // Get user ID
        const { data: users } = await supabase.auth.admin.listUsers()
        const user = users.users.find(u => u.email === 'daniel.elkaer@gmail.com')
        
        if (user) {
          // Update user profile to admin
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ role: 'admin' })
            .eq('email', 'daniel.elkaer@gmail.com')
          
          if (updateError) {
            console.error('Error updating user role:', updateError)
          } else {
            console.log('✅ User role updated to admin successfully!')
          }
        }
      } else {
        throw authError
      }
    } else {
      console.log('✅ Admin user created successfully!')
      console.log('User ID:', authData.user.id)
      
      // Wait for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Update to admin role
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role: 'admin' })
        .eq('user_id', authData.user.id)
      
      if (updateError) {
        console.error('Error setting admin role:', updateError)
      } else {
        console.log('✅ Admin role set successfully!')
      }
    }
    
    console.log('\nAdmin credentials:')
    console.log('Email: daniel.elkaer@gmail.com')
    console.log('Password: Mormor7594')
    console.log('\nYou can now login at /admin')
    
  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    process.exit(0)
  }
}

createAdminUser()