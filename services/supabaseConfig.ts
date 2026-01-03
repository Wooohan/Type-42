import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fiuodbhgvmylvbanbfve.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_secret_x33xGa8YmioWvfyvDtWNXA_fT_8VL9V';

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
