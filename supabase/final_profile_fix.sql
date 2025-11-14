-- Final Comprehensive Fix for Customer Profile Names
-- This script ensures all customer names display correctly in blog comments

-- 1. First, let's check the current state
SELECT '=== CURRENT STATE ANALYSIS ===' as status;
SELECT 
  'Total blog comments' as info,
  COUNT(*) as count
FROM blog_comments 
WHERE is_deleted = false;

SELECT 
  'Comments with customer_id' as info,
  COUNT(*) as count
FROM blog_comments 
WHERE is_deleted = false AND customer_id IS NOT NULL;

-- 2. Check profiles table structure and data
SELECT '=== PROFILES TABLE ANALYSIS ===' as status;
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY column_name;

SELECT 
  'Total profiles' as info,
  COUNT(*) as count
FROM profiles;

SELECT 
  'Profiles with full_name' as info,
  COUNT(full_name) as count
FROM profiles;

-- 3. Check auth.users for comparison
SELECT '=== AUTH USERS ANALYSIS ===' as status;
SELECT 
  'Total auth users' as info,
  COUNT(*) as count
FROM auth.users;

SELECT 
  'Auth users with metadata' as info,
  COUNT(*) as count
FROM auth.users 
WHERE raw_user_meta_data IS NOT NULL 
  AND raw_user_meta_data != '{}'::jsonb;

-- 4. Create or fix the profiles table structure
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Add missing columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 7. Fix the foreign key relationship
-- Drop existing constraint if it exists
ALTER TABLE blog_comments DROP CONSTRAINT IF EXISTS blog_comments_customer_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE blog_comments 
ADD CONSTRAINT blog_comments_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 8. Create a function to extract display name from user metadata
CREATE OR REPLACE FUNCTION extract_display_name(user_metadata jsonb, user_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    nullif(trim((user_metadata->>'full_name')::text), ''),
    nullif(trim((user_metadata->>'name')::text), ''),
    nullif(trim((user_metadata->>'user_name')::text), ''),
    nullif(trim((user_metadata->>'displayName')::text), ''),
    nullif(trim((user_metadata->>'username')::text), ''),
    split_part(trim(user_email), '@', 1)
  );
$$;

-- 9. Populate missing profiles from auth.users
INSERT INTO public.profiles (id, full_name, email, avatar_url)
SELECT 
  u.id,
  extract_display_name(u.raw_user_meta_data, u.email) as full_name,
  u.email,
  (u.raw_user_meta_data->>'avatar_url')::text as avatar_url
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM profiles WHERE id IS NOT NULL)
  AND u.id IN (SELECT DISTINCT customer_id FROM blog_comments WHERE customer_id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- 10. Update existing profiles with missing data
UPDATE public.profiles p
SET 
  full_name = COALESCE(
    p.full_name,
    extract_display_name(u.raw_user_meta_data, u.email)
  ),
  email = COALESCE(p.email, u.email),
  avatar_url = COALESCE(p.avatar_url, (u.raw_user_meta_data->>'avatar_url')::text),
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id 
  AND (p.full_name IS NULL OR p.full_name = '' OR p.email IS NULL);

-- 11. Create a view to test the relationship
CREATE OR REPLACE VIEW blog_comments_with_profiles AS
SELECT 
  c.id,
  c.blog_post_id,
  c.customer_id,
  c.content,
  c.created_at,
  c.is_deleted,
  c.parent_comment_id,
  p.full_name as customer_name,
  p.email as customer_email,
  p.avatar_url,
  CASE 
    WHEN p.full_name IS NOT NULL AND p.full_name != '' THEN p.full_name
    ELSE 'Guest ' || upper(substring(c.customer_id::text from 1 for 6))
  END as display_name
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
WHERE c.is_deleted = false;

-- 12. Test the view
SELECT '=== TESTING THE VIEW ===' as status;
SELECT 
  id,
  customer_id,
  customer_name,
  display_name,
  content
FROM blog_comments_with_profiles
ORDER BY created_at DESC
LIMIT 10;

-- 13. Check for any missing profiles for comment authors
SELECT '=== MISSING PROFILES FOR COMMENT AUTHORS ===' as status;
SELECT DISTINCT
  c.customer_id,
  u.email,
  u.raw_user_meta_data,
  'Missing profile for comment author' as issue
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
LEFT JOIN auth.users u ON u.id = c.customer_id
WHERE c.is_deleted = false
  AND p.id IS NULL
  AND c.customer_id IS NOT NULL;

-- 14. Insert any missing profiles found above
INSERT INTO public.profiles (id, full_name, email, avatar_url)
SELECT DISTINCT
  c.customer_id,
  extract_display_name(u.raw_user_meta_data, u.email),
  u.email,
  (u.raw_user_meta_data->>'avatar_url')::text
FROM blog_comments c
LEFT JOIN auth.users u ON u.id = c.customer_id
LEFT JOIN profiles p On p.id = c.customer_id
WHERE c.is_deleted = false
  AND p.id IS NULL
  AND c.customer_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 15. Final verification
SELECT '=== FINAL VERIFICATION ===' as status;
SELECT 
  COUNT(*) as total_comments,
  COUNT(p.full_name) as comments_with_real_names,
  COUNT(*) - COUNT(p.full_name) as comments_showing_guest,
  ROUND(
    (COUNT(p.full_name)::numeric / COUNT(*)::numeric) * 100, 1
  ) as percentage_with_names
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
WHERE c.is_deleted = false;

-- 16. Show sample of fixed data
SELECT '=== SAMPLE OF FIXED DATA ===' as status;
SELECT 
  c.id as comment_id,
  c.content,
  c.customer_id,
  p.full_name as profile_name,
  CASE 
    WHEN p.full_name IS NOT NULL AND p.full_name != '' THEN '✅ REAL NAME'
    ELSE '❌ GUEST FORMAT'
  END as name_status
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
WHERE c.is_deleted = false
ORDER BY c.created_at DESC
LIMIT 15;

-- 17. Clean up temporary function
DROP FUNCTION IF EXISTS extract_display_name(jsonb, text);

-- 18. Refresh schema cache
NOTIFY pgrst, 'reload config';