const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.development' })

async function runPsqlMigration() {
  console.log('Running expert_sessions migration via psql...')
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/003_expert_sessions.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
  
  // Extract database connection details from environment
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING
  
  if (!dbUrl) {
    console.error('POSTGRES_URL_NON_POOLING not found in environment')
    console.log('Please run the migration manually in Supabase SQL Editor:')
    console.log('1. Go to https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql')
    console.log('2. Copy and paste the contents of: supabase/migrations/003_expert_sessions.sql')
    console.log('3. Click "Run"')
    return
  }
  
  console.log('Attempting to run migration with psql...')
  
  // Try to run with psql
  const psql = spawn('psql', [dbUrl], { stdio: ['pipe', 'pipe', 'pipe'] })
  
  let output = ''
  let error = ''
  
  psql.stdout.on('data', (data) => {
    output += data.toString()
  })
  
  psql.stderr.on('data', (data) => {
    error += data.toString()
  })
  
  psql.on('close', (code) => {
    if (code === 0) {
      console.log('Migration completed successfully!')
      console.log('Output:', output)
    } else {
      console.log('psql not available or migration failed')
      console.log('Please run the migration manually in Supabase SQL Editor:')
      console.log('1. Go to https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql')
      console.log('2. Copy and paste the contents of: supabase/migrations/003_expert_sessions.sql')
      console.log('3. Click "Run"')
      
      if (error) {
        console.log('Error details:', error)
      }
    }
  })
  
  psql.on('error', (err) => {
    console.log('psql command not found. Please run migration manually.')
    console.log('Manual migration steps:')
    console.log('1. Go to https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql')
    console.log('2. Copy and paste the contents of: supabase/migrations/003_expert_sessions.sql')
    console.log('3. Click "Run"')
  })
  
  // Send the migration SQL to psql
  psql.stdin.write(migrationSQL)
  psql.stdin.end()
}

runPsqlMigration()