-- Test Enhanced Blog Comment Reply Notifications
-- This script tests the enhanced notification system that shows actual reply content

-- 1. Check if the new columns exist in customer_notifications table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_notifications' 
AND column_name IN ('reply_content', 'restaurant_name', 'blog_post_id');

-- 2. Test data - Find a sample blog post and customer
-- First, let's see what blog posts exist
SELECT 
  bp.id,
  bp.title,
  bp.restaurant_id,
  r.name as restaurant_name
FROM blog_posts bp
JOIN restaurants r ON bp.restaurant_id = r.id
WHERE bp.is_published = true
LIMIT 3;

-- 3. Test data - Find a sample customer who has commented
SELECT 
  bc.id,
  bc.blog_post_id,
  bc.customer_id,
  bc.content,
  bc.created_at,
  u.email as customer_email
FROM blog_comments bc
JOIN auth.users u ON bc.customer_id = u.id
WHERE bc.parent_comment_id IS NULL
LIMIT 3;

-- 4. Test the notification trigger by simulating a restaurant owner reply
-- First, let's create a test reply (you would replace the IDs with actual ones from your database)
-- INSERT INTO blog_comments (
--   blog_post_id,
--   customer_id,  -- This should be a restaurant owner's ID
--   content,
--   parent_comment_id
-- ) VALUES (
--   'your-blog-post-id-here',
--   'restaurant-owner-id-here', 
--   'Thank you for your feedback! We appreciate your comments about our new menu. We will definitely consider your suggestions for our upcoming specials.',
--   'customer-comment-id-here'
-- );

-- 5. Check if the notification was created with the enhanced data
-- SELECT 
--   cn.id,
--   cn.title,
--   cn.message,
--   cn.reply_content,
--   cn.restaurant_name,
--   cn.blog_post_id,
--   cn.created_at,
--   cn.status
-- FROM customer_notifications cn
-- WHERE cn.title = 'Comment Reply'
-- ORDER BY cn.created_at DESC
-- LIMIT 5;

-- 6. Test the blog post details loading
-- SELECT 
--   bp.id,
--   bp.title,
--   bp.content,
--   bp.created_at,
--   r.name as restaurant_name,
--   r.image_url as restaurant_image
-- FROM blog_posts bp
-- JOIN restaurants r ON bp.restaurant_id = r.id
-- WHERE bp.id = 'your-blog-post-id-here';

-- 7. Verify the notification trigger is active
SELECT 
  evtname as trigger_name,
  evnt as event,
  enabled
FROM pg_trigger
WHERE tblname = 'blog_comments'
AND evtname = 'trg_blog_comment_reply_notification';

-- 8. Cleanup test data (run this after testing)
-- DELETE FROM blog_comments 
-- WHERE parent_comment_id = 'customer-comment-id-here'
-- AND content LIKE '%Thank you for your feedback%';

-- DELETE FROM customer_notifications
-- WHERE title = 'Comment Reply'
-- AND created_at > NOW() - INTERVAL '1 hour';

-- Status check
SELECT 'Enhanced blog comment reply notification system is ready for testing' as status;