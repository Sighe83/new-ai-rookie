import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSlotGeneration() {
  console.log("Testing Slot Generation System...\n")
  
  try {
    // 1. Check for existing availability windows
    console.log("1. Checking existing availability windows...")
    const { data: windows, error: windowsError } = await supabase
      .from("availability_windows")
      .select("id, expert_id, start_at, end_at, is_closed")
      .eq("is_closed", false)
      .gte("end_at", new Date().toISOString())
      .limit(5)
    
    if (windowsError) {
      console.error("Error fetching availability windows:", windowsError)
      return
    }
    
    const windowCount = windows ? windows.length : 0
    console.log("Found " + windowCount + " active availability windows")
    
    if (windows && windows.length > 0) {
      const window = windows[0]
      console.log("\nTesting with window ID: " + window.id)
      console.log("Window period: " + window.start_at + " to " + window.end_at)
    }
    
  } catch (error) {
    console.error("Test failed:", error)
  }
}

// Run the test
testSlotGeneration()
