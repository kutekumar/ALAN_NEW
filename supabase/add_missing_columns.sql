-- Add Missing Columns to customer_notifications table
-- This script adds the required columns for enhanced blog comment reply notifications

-- Add the missing columns to customer_notifications table
ALTER TABLE IF EXISTS public.customer_notifications 
ADD COLUMN IF NOT EXISTS reply_content text,
ADD COLUMN IF NOT EXISTS restaurant_name text,
ADD COLUMN IF NOT EXISTS blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE;

-- Create index for better performance on blog post notifications
CREATE INDEX IF NOT EXISTS idx_customer_notifications_blog_post_id 
ON public.customer_notifications (blog_post_id);

-- Verify the columns were added successfully
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'customer_notifications' 
AND column_name IN ('reply_content', 'restaurant_name', 'blog_post_id')
ORDER BY column_name;

-- Check if the trigger exists and is active
SELECT 
    evtname as trigger_name,
    evnt as event,
    enabled,
    tgisinternal
FROM pg_trigger
WHERE tblname = 'blog_comments'
AND evtname = 'trg_blog_comment_reply_notification';

-- Status message
SELECT 'Columns added successfully. The enhanced notification system should now work properly.' as status;