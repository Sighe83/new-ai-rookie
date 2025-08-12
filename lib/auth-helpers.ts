import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function getAuthenticatedUser(request: NextRequest) {
  // Create service role client for admin operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  // Get access token from Authorization header
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, userError: new Error('No authorization header'), supabase: supabaseAdmin }
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  // Verify the JWT token
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  
  return { user, userError, supabase: supabaseAdmin }
}