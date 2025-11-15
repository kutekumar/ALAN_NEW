-- SIMPLE FIX FOR ENHANCED BLOG COMMENT REPLY NOTIFICATIONS
-- Copy and paste this entire script into your Supabase SQL editor and run it

-- Step 1: Add missing columns to customer_notifications table (safe to run multiple times)
ALTER TABLE IF EXISTS public.customer_notifications 
ADD COLUMN IF NOT EXISTS reply_content text,
ADD COLUMN IF NOT EXISTS restaurant_name text,
ADD COLUMN IF NOT EXISTS blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE;

-- Step 2: Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trg_blog_comment_reply_notification ON public.blog_comments;
DROP FUNCTION IF EXISTS public.handle_blog_comment_reply();

-- Step 3: Create the enhanced trigger function
CREATE OR REPLACE FUNCTION public.handle_blog_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_restaurant_name text;
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

  -- Get restaurant name
  SELECT r.name INTO v_restaurant_name
  FROM public.blog_posts bp
  JOIN public.restaurants r ON bp.restaurant_id = r.id
  WHERE bp.id = NEW.blog_post_id;

  -- Get the actual reply content
  v_reply_content := NEW.content;

  -- Create personalized notification message
  INSERT INTO public.customer_notifications (
    customer_id,
    order_id,
    title,
    message,
    status,
    blog_post_id,
    reply_content,
    restaurant_name
  )
  VALUES (
    v_customer_id,
    NULL,
    'Comment Reply',
    v_restaurant_name || ' replied: "' || 
    CASE 
      WHEN length(v_reply_content) > 100 THEN left(v_reply_content, 97) || '...'
      ELSE v_reply_content
    END || '"',
    'unread',
    NEW.blog_post_id,
    v_reply_content,
    v_restaurant_name
  );

  RETURN NEW;
END;
$$;

-- Step 4: Create the trigger
CREATE TRIGGER trg_blog_comment_reply_notification
  AFTER INSERT ON public.blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_blog_comment_reply();

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_notifications_blog_post_id 
ON public.customer_notifications (blog_post_id);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id_status
ON public.customer_notifications (customer_id, status, created_at DESC);

-- Step 6: Simple verification - just show success message
SELECT 'SUCCESS: Enhanced Blog Comment Reply Notifications Setup Complete!' as status;

-- Step 7: Show which columns were added
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'customer_notifications' 
AND column_name IN ('blog_post_id', 'reply_content', 'restaurant_name')
ORDER BY column_name;