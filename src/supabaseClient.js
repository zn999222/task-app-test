import { createClient } from '@supabase/supabase-js'

// Single shared Supabase client, reused for all auth and data calls.
// Anon key is public-safe by design (row-level security enforces ownership).
const SUPABASE_URL = 'https://sicbfnrtxknninshzoql.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpY2JmbnJ0eGtubmluc2h6b3FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNTQ3ODksImV4cCI6MjExMDgzMDc4OX0.WStYjzfys4GTGwXEnSMmPEBRhz-OmGEMsForgrV70sQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
