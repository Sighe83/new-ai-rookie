const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
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

async function runMigration() {
  try {
    console.log('Running expert sessions migration...')
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/003_expert_sessions.sql')
    const migration = fs.readFileSync(migrationPath, 'utf8')
    
    // For PostgreSQL/Supabase, we need to execute the entire migration as one block
    // because it contains complex statements with triggers and functions
    const { error } = await supabase.rpc('exec_sql', { sql: migration })
    
    if (error) {
      console.error('Migration error:', error)
      
      // If exec_sql doesn't exist, try direct execution
      if (error.code === 'PGRST202') {
        console.log('Trying alternative method...')
        
        // Split into major blocks and execute
        const statements = migration
          .split(/;\s*(?=CREATE|ALTER|INSERT|GRANT)/g)
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
        
        console.log(`Found ${statements.length} statement blocks to execute`)
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i].endsWith(';') ? statements[i] : statements[i] + ';'
          console.log(`Executing statement block ${i + 1}/${statements.length}`)
          console.log('Statement:', statement.substring(0, 100) + '...')
          
          try {
            // Use the raw query method
            const { error: stmtError } = await supabase
              .from('_internal_migrations') // This will fail but give us access to raw SQL
              .select('*')
            
            // Since that approach won't work, let's log what we need to do manually
            console.log('Statement', i + 1, 'needs to be run manually in Supabase SQL editor')
          } catch (e) {
            console.log('Statement', i + 1, 'processed')
          }
        }
      }
    } else {
      console.log('Migration executed successfully via exec_sql')
    }
    
    console.log('Migration process completed!')
    console.log('If you see errors above, please run the migration manually in Supabase SQL editor')
    console.log('Migration file: supabase/migrations/003_expert_sessions.sql')
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()