-- Add blog_post_id column to customer_notifications table
-- This enables proper linking from notifications to specific blog posts

-- 1. Add blog_post_id column to customer_notifications table
ALTER TABLE IF EXISTS public.customer_notifications 
ADD COLUMN IF NOT EXISTS blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE;

-- 2. Update existing blog comment reply notifications to include blog_post_id
-- This query finds notifications with title 'Comment Reply' and tries to link them to blog posts
UPDATE public.customer_notifications cn
SET blog_post_id = (
  SELECT DISTINCT bc.blog_post_id 
  FROM public.blog_comments bc
  WHERE bc.customer_id = cn.customer_id
  AND bc.created_at <= cn.created_at
  AND bc.parent_comment_id IS NULL
  ORDER BY bc.created_at DESC
  LIMIT 1
)
WHERE cn.title = 'Comment Reply' 
AND cn.blog_post_id IS NULL;

-- 3. Create index for better performance on blog post notifications
CREATE INDEX IF NOT EXISTS idx_customer_notifications_blog_post_id 
ON public.customer_notifications (blog_post_id);

-- 4. Verify the changes
SELECT 
  'Blog post ID column added to customer_notifications' as status,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE blog_post_id IS NOT NULL) as notifications_with_blog_post_id
FROM public.customer_notifications 
WHERE title = 'Comment Reply';