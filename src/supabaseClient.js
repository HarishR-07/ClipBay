import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_PROJECT_URL_HERE'
const supabaseAnonKey = 'YOUR_PUBLISHABLE_KEY_HERE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
