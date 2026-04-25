import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://etcexnvcwupxvxwhdlce.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Y2V4bnZjd3VweHZ4d2hkbGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDUwMjQsImV4cCI6MjA5MjQyMTAyNH0.Xz3MSJUjavHDgp28Htdpvu8G9S8xVxtNKjbuoA8W16c'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
