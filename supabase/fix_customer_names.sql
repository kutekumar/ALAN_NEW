-- Quick Fix for Customer Names in Blog Comments
-- Run this in Supabase SQL editor to fix the immediate name display issues

-- 1. First, let's check what's in the profiles table
SELECT 'Checking profiles table structure and data' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('id', 'full_name', 'email');

-- 2. Check if profiles exist for blog comment authors
SELECT 'Checking profiles for blog comment authors' as status;
SELECT DISTINCT c.customer_id, p.id as profile_id, p.full_name, u.email
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
LEFT JOIN auth.users u ON u.id = c.customer_id
WHERE c.is_deleted = false
ORDER BY c.created_at DESC
LIMIT 20;

-- 3. Create profiles table if it doesn't exist (simplified version)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'blog_comments_customer_id_fkey'
  ) THEN
    ALTER TABLE blog_comments 
    ADD CONSTRAINT blog_comments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Populate missing profiles from auth.users
INSERT INTO public.profiles (id, full_name, email)
SELECT 
  id,
  COALESCE(
    nullif((raw_user_meta_data->>'full_name')::text, ''),
    nullif((raw_user_meta_data->>'name')::text, ''),
    nullif((raw_user_meta_data->>'user_name')::text, ''),
    split_part(email, '@', 1)
  ) as full_name,
  email
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- 7. Update existing profiles with data from auth.users
UPDATE public.profiles p
SET 
  full_name = COALESCE(
    p.full_name,
    (u.raw_user_meta_data->>'full_name')::text,
    (u.raw_user_meta_data->>'name')::text,
    (u.raw_user_meta_data->>'user_name')::text,
    split_part(u.email, '@', 1)
  ),
  email = COALESCE(p.email, u.email)
FROM auth.users u
WHERE p.id = u.id 
  AND (p.full_name IS NULL OR p.full_name = '');

-- 8. Verify the fix
SELECT 'After fix - checking profiles and comments relationship' as status;
SELECT 
  c.id as comment_id,
  c.content,
  c.customer_id,
  p.full_name as profile_name,
  u.email as auth_email,
  CASE 
    WHEN p.full_name IS NOT NULL AND p.full_name != '' THEN '✅ Has Name'
    ELSE '❌ No Name'
  END as profile_status
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
LEFT JOIN auth.users u ON u.id = c.customer_id
WHERE c.is_deleted = false
ORDER BY c.created_at DESC
LIMIT 10;

-- 10. Test the exact query used by the frontend
SELECT 'Testing frontend query structure' as status;
SELECT 
  c.*,
  p.full_name
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
WHERE c.is_deleted = false
  AND c.blog_post_id IS NOT NULL
ORDER BY c.created_at DESC
LIMIT 5;