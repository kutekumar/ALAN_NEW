-- Corrected Fix for Customer Names in Blog Comments
-- This version handles existing profiles table structure

-- 1. Check existing profiles table structure
SELECT 'Current profiles table structure:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY column_name;

-- 2. Add email column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 3. Check if foreign key constraint exists
SELECT 'Foreign key constraints check:' as status;
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'blog_comments';

-- 4. Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'blog_comments_customer_id_fkey'
  ) THEN
    -- Drop existing constraint if it points to wrong table
    ALTER TABLE blog_comments DROP CONSTRAINT IF EXISTS blog_comments_customer_id_fkey;
    
    -- Add correct foreign key constraint
    ALTER TABLE blog_comments 
    ADD CONSTRAINT blog_comments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added foreign key constraint blog_comments_customer_id_fkey';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- 5. Create a temporary function to get user display name
CREATE OR REPLACE FUNCTION get_user_display_name(user_data jsonb, user_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    nullif((user_data->>'full_name')::text, ''),
    nullif((user_data->>'name')::text, ''),
    nullif((user_data->>'user_name')::text, ''),
    split_part(user_email, '@', 1)
  );
$$;

-- 6. Insert missing profiles from auth.users
INSERT INTO public.profiles (id, full_name)
SELECT 
  u.id,
  get_user_display_name(u.raw_user_meta_data, u.email) as full_name
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM profiles WHERE id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. Update existing profiles with missing full_name
UPDATE public.profiles p
SET 
  full_name = COALESCE(
    p.full_name,
    get_user_display_name(u.raw_user_meta_data, u.email)
  ),
  email = COALESCE(p.email, u.email)
FROM auth.users u
WHERE p.id = u.id 
  AND (p.full_name IS NULL OR p.full_name = '');

-- 8. Clean up temporary function
DROP FUNCTION IF EXISTS get_user_display_name(jsonb, text);

-- 9. Verify the fix - check profiles for blog comment authors
SELECT 'Verification - profiles for blog comment authors:' as status;
SELECT 
  c.id as comment_id,
  c.customer_id,
  p.id as profile_id,
  p.full_name,
  u.email,
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

-- 10. Test the join query that frontend uses
SELECT 'Testing frontend join query:' as status;
SELECT 
  c.id,
  c.content,
  c.customer_id,
  p.full_name
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
WHERE c.is_deleted = false
  AND c.blog_post_id IS NOT NULL
ORDER BY c.created_at DESC
LIMIT 5;

-- 11. Refresh the schema cache
NOTIFY pgrst, 'reload config';

-- 12. Final status check
SELECT 'Final status - profiles table:' as status;
SELECT 
  COUNT(*) as total_profiles,
  COUNT(full_name) as profiles_with_name,
  COUNT(*) - COUNT(full_name) as profiles_without_name
FROM profiles;

SELECT 'Final status - blog comments:' as status;  
SELECT 
  COUNT(*) as total_comments,
  COUNT(p.full_name) as comments_with_customer_name,
  COUNT(*) - COUNT(p.full_name) as comments_showing_guest
FROM blog_comments c
LEFT JOIN profiles p ON p.id = c.customer_id
WHERE c.is_deleted = false;