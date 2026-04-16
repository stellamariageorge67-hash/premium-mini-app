-- DY SHOWS - Supabase Database Setup
-- Run this in your Supabase SQL Editor

-- Content table (movies and series)
CREATE TABLE IF NOT EXISTS content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('movie', 'series')),
  genre TEXT NOT NULL,
  poster_url TEXT,
  trailer_url TEXT,
  about_text TEXT,
  rating NUMERIC(3,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files table (downloadable files per content)
CREATE TABLE IF NOT EXISTS files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  quality TEXT NOT NULL,
  telegram_file_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requests table (user movie requests)
CREATE TABLE IF NOT EXISTS requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  movie_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by the backend)
CREATE POLICY "service_role_all_content" ON content FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_files" ON files FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_requests" ON requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon read for content and files (Mini App fetches them)
CREATE POLICY "anon_read_content" ON content FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_files" ON files FOR SELECT TO anon USING (true);
