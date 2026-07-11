import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://srucmoiejugwbozhnoma.supabase.co/rest/v1/'
const supabaseAnonKey = 'YOUR_PUBLISHABLE_KEY_HERE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
