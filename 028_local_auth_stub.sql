-- ============================================================
-- NawwatOS — Migration 028_local_auth_stub
-- Adds missing auth dependencies to bypass frontend Loading state
-- ============================================================

BEGIN;

-- 1. Ensure public.users exists if not already present in the local dump
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  email TEXT
);

-- 2. Add role column in users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner'; 

-- 3. Create public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We default 'owner' to ensure the Commerce UI role gates pass. 
COMMIT;
