import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fiuodbhgvmylvbanbfve.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdW9kYmhndm15bHZiYW5iZnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyNjIxMzEsImV4cCI6MjA2MTgzODEzMX0.7V_0vJqYb8PcQ2Wz3Z8k8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://fiuodbhgvmylvbanbfve.supabase.co';
};

// Tables configuration
export const TABLES = {
  USERS: 'users',
  PAGES: 'facebook_pages',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  APPROVED_LINKS: 'approved_links',
  APPROVED_MEDIA: 'approved_media'
} as const;

// Real-time channels
export const CHANNELS = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  PRESENCE: 'presence'
} as const;