-- Test Script for All Notification and Filter Features
-- This script tests the complete notification system and filter functionality

-- 1. Test the new blog comment notifications table
SELECT 'Testing blog comment notifications table...' as test_phase;

-- Check if the table exists and has the correct structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'blog_comment_notifications'
ORDER BY ordinal_position;

-- 2. Test existing notification triggers are still working
SELECT 'Testing existing notification triggers...' as test_phase;

-- Check trigger status for both triggers
SELECT 
  tgname as trigger_name,
  tgenabled as enabled_status,
  tgisinternal as is_internal
FROM pg_trigger 
WHERE tgname IN ('trg_blog_comment_reply_notification', 'trg_blog_comment_notification')
ORDER BY trigger_name;

-- 3. Test data integrity - find sample blog posts and comments
SELECT 'Testing data for notifications...' as test_phase;

-- Get sample blog posts
SELECT 
  bp.id as blog_post_id,
  bp.title,
  bp.restaurant_id,
  r.name as restaurant_name,
  bp.is_published
FROM blog_posts bp
JOIN restaurants r ON bp.restaurant_id = r.id
WHERE bp.is_published = true
LIMIT 3;

-- Get sample comments to understand structure
SELECT 
  bc.id as comment_id,
  bc.blog_post_id,
  bc.customer_id,
  bc.content,
  bc.parent_comment_id,
  bc.created_at,
  u.email as customer_email
FROM blog_comments bc
JOIN auth.users u ON bc.customer_id = u.id
WHERE bc.created_at > NOW() - INTERVAL '30 days'
ORDER BY bc.created_at DESC
LIMIT 5;

-- 4. Test notification tables have data
SELECT 'Testing notification data...' as test_phase;

-- Check customer notifications
SELECT 
  'Customer Notifications' as type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
  COUNT(*) FILTER (WHERE status = 'read') as read_count
FROM customer_notifications
UNION ALL
-- Check blog comment notifications for restaurant owners
SELECT 
  'Blog Comment Notifications' as type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
  COUNT(*) FILTER (WHERE status = 'read') as read_count
FROM blog_comment_notifications;

-- 5. Test recent notifications with enrichment
SELECT 'Testing recent notifications with details...' as test_phase;

-- Recent customer notifications (blog comment replies)
SELECT 
  cn.id,
  cn.title,
  cn.message,
  cn.status,
  cn.created_at,
  cn.restaurant_name,
  bp.title as blog_title
FROM customer_notifications cn
LEFT JOIN blog_posts bp ON cn.blog_post_id = bp.id
WHERE cn.title = 'Comment Reply'
ORDER BY cn.created_at DESC
LIMIT 5;

-- Recent blog comment notifications for restaurant owners
SELECT
  bcn.id,
  bcn.title,
  bcn.message,
  bcn.status,
  bcn.created_at,
  bcn.comment_content,
  bp.title as blog_title,
  r.name as restaurant_name,
  u.email as customer_email
FROM blog_comment_notifications bcn
LEFT JOIN blog_posts bp ON bcn.blog_post_id = bp.id
LEFT JOIN restaurants r ON bcn.restaurant_id = r.id
LEFT JOIN auth.users u ON bcn.customer_id = u.id
ORDER BY bcn.created_at DESC
LIMIT 5;

-- 6. Test database performance - check indexes
SELECT 'Testing database indexes...' as test_phase;

-- Check if indexes exist for performance
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('customer_notifications', 'blog_comment_notifications', 'blog_comments')
AND indexname LIKE '%notification%'
ORDER BY indexname;

-- 7. Test search and filter functionality (simulated)
SELECT 'Testing search and filter scenarios...' as test_phase;

-- Simulate search query scenarios
WITH search_scenarios AS (
  SELECT 'spicy' as search_term
  UNION ALL SELECT 'menu'
  UNION ALL SELECT 'special'
)
SELECT 
  ss.search_term,
  COUNT(*) FILTER (WHERE bp.title ILIKE '%' || ss.search_term || '%') as matching_posts
FROM search_scenarios ss
CROSS JOIN blog_posts bp
WHERE bp.is_published = true
GROUP BY ss.search_term;

-- 8. Test restaurant filtering
SELECT 'Testing restaurant filtering...' as test_phase;

SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  COUNT(bp.id) as total_posts,
  COUNT(bp.id) FILTER (WHERE bp.is_published = true) as published_posts,
  COUNT(bp.id) FILTER (WHERE bp.is_published = false) as draft_posts,
  COUNT(bp.id) FILTER (WHERE bp.is_pinned = true) as pinned_posts
FROM restaurants r
LEFT JOIN blog_posts bp ON r.id = bp.restaurant_id
GROUP BY r.id, r.name
ORDER BY total_posts DESC;

-- 9. Test comment statistics for filtering
SELECT 'Testing comment statistics...' as test_phase;

SELECT 
  bc.blog_post_id,
  bp.title as blog_title,
  COUNT(bc.id) as total_comments,
  COUNT(bc.id) FILTER (WHERE bc.parent_comment_id IS NULL) as main_comments,
  COUNT(bc.id) FILTER (WHERE bc.parent_comment_id IS NOT NULL) as replies
FROM blog_posts bp
LEFT JOIN blog_comments bc ON bp.id = bc.blog_post_id
WHERE bp.is_published = true
GROUP BY bc.blog_post_id, bp.title
ORDER BY total_comments DESC
LIMIT 10;

-- 10. Final status check
SELECT 'All notification and filter features are ready for testing' as final_status;