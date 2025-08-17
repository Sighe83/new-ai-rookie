#!/usr/bin/env npx tsx

import { createAdminUser } from '../lib/admin-auth'

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  const displayName = process.argv[4]

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [display_name]')
    process.exit(1)
  }

  try {
    console.log('Creating admin user...')
    const result = await createAdminUser(email, password, {
      display_name: displayName
    })
    
    console.log('✅ Admin user created successfully!')
    console.log('Email:', result.user.email)
    console.log('User ID:', result.user.id)
    console.log('Profile ID:', result.profile.id)
    console.log('Role:', result.profile.role)
  } catch (error) {
    console.error('❌ Failed to create admin user:', error)
    process.exit(1)
  }
}

main()