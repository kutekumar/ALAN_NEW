-- Test Blog Comment Reply Notifications
-- This script tests the notification system for blog comment replies

-- 1. Check if the blog_post_id column exists in customer_notifications
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_notifications' 
AND column_name = 'blog_post_id';

-- 2. Check existing blog comment reply notifications
SELECT 
  id,
  customer_id,
  title,
  message,
  status,
  created_at,
  blog_post_id,
  -- Get the blog post title for reference
  (SELECT title FROM blog_posts WHERE id = cn.blog_post_id) as blog_title
FROM customer_notifications cn
WHERE title = 'Comment Reply'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if there are any blog comment reply notifications without blog_post_id
SELECT 
  COUNT(*) as notifications_without_blog_post_id
FROM customer_notifications 
WHERE title = 'Comment Reply' 
AND blog_post_id IS NULL;

-- 4. Test data: Show recent blog comments to understand the structure
SELECT 
  bc.id,
  bc.blog_post_id,
  bc.customer_id,
  bc.content,
  bc.parent_comment_id,
  bc.created_at,
  -- Get the blog post title
  bp.title as blog_title,
  -- Get the restaurant name
  r.name as restaurant_name
FROM blog_comments bc
LEFT JOIN blog_posts bp ON bc.blog_post_id = bp.id
LEFT JOIN restaurants r ON bp.restaurant_id = r.id
WHERE bc.created_at > NOW() - INTERVAL '7 days'
ORDER BY bc.created_at DESC
LIMIT 20;

-- 5. Check trigger status
SELECT 
  tgname as trigger_name,
  tgenabled as enabled_status,
  tgtype as trigger_type
FROM pg_trigger 
WHERE tgname = 'trg_blog_comment_reply_notification';

-- 6. Show notification table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'customer_notifications'
ORDER BY ordinal_position;