const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.development' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTable() {
  console.log('Creating expert_sessions table using direct SQL...')
  
  // Basic table creation SQL
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.expert_sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      expert_id UUID NOT NULL,
      title TEXT NOT NULL,
      short_description TEXT NOT NULL,
      topic_tags TEXT[] DEFAULT '{}',
      duration_minutes INTEGER NOT NULL,
      price_amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'DKK',
      level TEXT,
      prerequisites TEXT,
      materials_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT valid_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
      CONSTRAINT valid_description_length CHECK (char_length(short_description) >= 10 AND char_length(short_description) <= 500),
      CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes % 15 = 0 AND duration_minutes <= 480),
      CONSTRAINT valid_price CHECK (price_amount >= 0),
      CONSTRAINT valid_currency_format CHECK (currency ~ '^[A-Z]{3}$')
    );
  `
  
  try {
    // Try to create a test expert session to see if table structure works
    const testData = {
      expert_id: '00000000-0000-0000-0000-000000000001',
      title: 'Test Session',
      short_description: 'This is a test session to verify table creation',
      topic_tags: ['test', 'verification'],
      duration_minutes: 60,
      price_amount: 10000,
      currency: 'DKK'
    }
    
    // Try inserting - this will help us understand if table exists
    const { data, error } = await supabase
      .from('expert_sessions')
      .insert(testData)
      .select()
    
    if (error) {
      if (error.code === 'PGRST106') {
        console.log('Table does not exist. You need to create it manually.')
        console.log('Please run this SQL in your Supabase SQL editor:')
        console.log('\n' + createTableSQL + '\n')
        console.log('Then run the full migration file: supabase/migrations/003_expert_sessions.sql')
      } else {
        console.log('Table exists but insert failed:', error.message)
        console.log('This might be due to foreign key constraints or RLS policies not being set up yet.')
      }
    } else {
      console.log('Table exists and test insert successful!')
      console.log('Cleaning up test data...')
      
      // Delete the test record
      await supabase
        .from('expert_sessions')
        .delete()
        .eq('id', data[0].id)
      
      console.log('Table is ready to use!')
    }
    
  } catch (error) {
    console.error('Error checking table:', error)
  }
}

createTable()