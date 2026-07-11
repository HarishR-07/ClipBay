import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://srucmoiejugwbozhnoma.supabase.co'
const supabaseAnonKey = 'sb_publishable__VOl5BNHr2Tc02PQuNunBg_0ugx01Te'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
