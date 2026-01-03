-- Supabase Database Setup for MessengerFlow
-- Run this SQL in your Supabase SQL Editor

-- Enable Row Level Security on all tables
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'AGENT',
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  assigned_page_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create facebook_pages table
CREATE TABLE IF NOT EXISTS facebook_pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  is_connected BOOLEAN DEFAULT false,
  access_token TEXT,
  assigned_agent_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_avatar TEXT,
  customer_avatar_blob BYTEA,
  last_message TEXT NOT NULL,
  last_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_agent_id TEXT,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  is_incoming BOOLEAN DEFAULT true,
  is_read BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create approved_links table
CREATE TABLE IF NOT EXISTS approved_links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create approved_media table
CREATE TABLE IF NOT EXISTS approved_media (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  is_local BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_conversations_page_id ON conversations(page_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_agent_id ON conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_timestamp ON conversations(last_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_is_connected ON facebook_pages(is_connected);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_media ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can read all users
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id);

-- Authenticated users can manage pages
CREATE POLICY "Authenticated users can manage pages" ON facebook_pages FOR ALL USING (auth.role() = 'authenticated');

-- Users can read all conversations
CREATE POLICY "Users can read all conversations" ON conversations FOR SELECT USING (true);

-- Users can update conversations they're assigned to
CREATE POLICY "Users can update assigned conversations" ON conversations FOR UPDATE USING (assigned_agent_id = auth.uid()::text OR auth.role() = 'authenticated');

-- Users can read all messages
CREATE POLICY "Users can read all messages" ON messages FOR SELECT USING (true);

-- Users can insert messages
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can manage approved links and media
CREATE POLICY "Authenticated users can manage approved links" ON approved_links FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage approved media" ON approved_media FOR ALL USING (auth.role() = 'authenticated');

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_pages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE approved_links;
ALTER PUBLICATION supabase_realtime ADD TABLE approved_media;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facebook_pages_updated_at BEFORE UPDATE ON facebook_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: Admin@1122)
INSERT INTO users (id, name, email, password, role, avatar, status, assigned_page_ids)
VALUES (
  'admin-0',
  'Main Admin',
  'wooohan3@gmail.com',
  'Admin@1122',
  'SUPER_ADMIN',
  'https://picsum.photos/seed/admin-main/200',
  'online',
  '{}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, password, role, avatar, status, assigned_page_ids)
VALUES (
  'admin-1',
  'Alex Johnson',
  'admin@messengerflow.io',
  'password123',
  'SUPER_ADMIN',
  'https://picsum.photos/seed/admin/200',
  'online',
  '{}'
) ON CONFLICT (id) DO NOTHING;