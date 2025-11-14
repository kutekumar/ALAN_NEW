-- Fix Profiles and Relationships for Blog Comments
-- Run this in Supabase SQL editor to ensure proper profile data and relationships

-- 1. Ensure profiles table has proper structure
-- Check if profiles table exists and has full_name column
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    -- Create profiles table if it doesn't exist
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name text,
      avatar_url text,
      email text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for profiles
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
      
    -- Create index
    CREATE INDEX idx_profiles_id ON public.profiles(id);
  ELSE
    -- Add full_name column if it doesn't exist
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
  END IF;
END $$;

-- 2. Ensure the foreign key relationship exists
-- Drop existing constraint if it exists
ALTER TABLE IF EXISTS public.blog_comments 
DROP CONSTRAINT IF EXISTS blog_comments_customer_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE public.blog_comments 
ADD CONSTRAINT blog_comments_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Create a function to populate profiles from auth.users if needed
CREATE OR REPLACE FUNCTION populate_profiles_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Insert missing profiles from auth.users
  FOR user_record IN 
    SELECT id, email, raw_user_meta_data 
    FROM auth.users 
    WHERE id NOT IN (SELECT id FROM public.profiles)
  LOOP
    -- Try to get full_name from raw_user_meta_data or use email
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
      user_record.id,
      COALESCE(
        (user_record.raw_user_meta_data->>'full_name')::text,
        (user_record.raw_user_meta_data->>'name')::text,
        split_part(user_record.email, '@', 1)
      ),
      user_record.email
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;

-- 4. Create a trigger to automatically create profiles for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'full_name')::text,
      (NEW.raw_user_meta_data->>'name')::text,
      split_part(NEW.email, '@', 1)
    ),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Force update of existing profiles with data from auth.users
UPDATE public.profiles p
SET 
  full_name = COALESCE(
    (u.raw_user_meta_data->>'full_name')::text,
    (u.raw_user_meta_data->>'name')::text,
    split_part(u.email, '@', 1),
    p.full_name
  ),
  email = COALESCE(u.email, p.email)
FROM auth.users u
WHERE p.id = u.id 
  AND (p.full_name IS NULL OR p.full_name = '' OR p.email IS NULL);

-- 6. Refresh the schema cache
NOTIFY pgrst, 'reload config';

-- 7. Test the relationship
-- This query should show the relationship working
SELECT 
  c.id,
  c.content,
  c.customer_id,
  p.full_name as profile_name,
  u.email as auth_email,
  u.raw_user_meta_data
FROM public.blog_comments c
LEFT JOIN public.profiles p ON p.id = c.customer_id
LEFT JOIN auth.users u ON u.id = c.customer_id
WHERE c.is_deleted = false
LIMIT 10;