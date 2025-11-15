-- Fix and Enhance Blog Comment Reply Trigger
-- This script ensures the trigger is properly set up with all required columns

-- 1. First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS trg_blog_comment_reply_notification ON public.blog_comments;

-- 2. Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.handle_blog_comment_reply();

-- 3. Create the enhanced function to handle blog comment replies
CREATE OR REPLACE FUNCTION public.handle_blog_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_restaurant_name text;
  v_customer_name text;
  v_blog_title text;
  v_notification_message text;
  v_reply_content text;
BEGIN
  -- Only process replies (comments with parent_comment_id)
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the customer who wrote the original comment
  SELECT customer_id INTO v_customer_id
  FROM public.blog_comments
  WHERE id = NEW.parent_comment_id;

  -- If we can't find the customer, exit
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get restaurant name (we need to find which restaurant this blog post belongs to)
  SELECT r.name INTO v_restaurant_name
  FROM public.blog_posts bp
  JOIN public.restaurants r ON bp.restaurant_id = r.id
  WHERE bp.id = NEW.blog_post_id;

  -- Get the customer's display name
  SELECT COALESCE(
    p.full_name,
    split_part(u.email, '@', 1)
  ) INTO v_customer_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_customer_id;

  -- Get the blog post title
  SELECT title INTO v_blog_title
  FROM public.blog_posts
  WHERE id = NEW.blog_post_id;

  -- Get the actual reply content
  v_reply_content := NEW.content;

  -- Create personalized notification message that includes the actual reply
  v_notification_message := format(
    '%s replied: "%s"',
    COALESCE(v_restaurant_name, 'Restaurant'),
    -- Truncate reply content to 100 characters for notification preview
    CASE 
      WHEN length(v_reply_content) > 100 THEN left(v_reply_content, 97) || '...'
      ELSE v_reply_content
    END
  );

  -- Insert notification for the customer
  INSERT INTO public.customer_notifications (
    customer_id,
    order_id, -- NULL since this is not order-related
    title,
    message,
    status,
    blog_post_id,
    -- Add new fields for enhanced display
    reply_content,
    restaurant_name
  )
  VALUES (
    v_customer_id,
    NULL, -- No order associated with blog comment notifications
    'Comment Reply',
    v_notification_message,
    'unread',
    NEW.blog_post_id, -- Include the blog post ID
    v_reply_content, -- Store the full reply content
    v_restaurant_name -- Store restaurant name for better display
  );

  -- Return the new comment
  RETURN NEW;
END;
$$;

-- 4. Create the trigger for blog comment replies
CREATE TRIGGER trg_blog_comment_reply_notification
  AFTER INSERT ON public.blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_blog_comment_reply();

-- 5. Add the missing columns if they don't exist (safety check)
ALTER TABLE IF EXISTS public.customer_notifications 
ADD COLUMN IF NOT EXISTS reply_content text,
ADD COLUMN IF NOT EXISTS restaurant_name text,
ADD COLUMN IF NOT EXISTS blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id_status
  ON public.customer_notifications (customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_blog_post_id 
  ON public.customer_notifications (blog_post_id);

-- 7. Verify everything is set up correctly
SELECT 
    'Trigger and function created successfully' as status,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tblname = 'blog_comments' AND evtname = 'trg_blog_comment_reply_notification') as trigger_exists,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'handle_blog_comment_reply') as function_exists,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'blog_post_id') as blog_post_id_exists,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'reply_content') as reply_content_exists,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'restaurant_name') as restaurant_name_exists;