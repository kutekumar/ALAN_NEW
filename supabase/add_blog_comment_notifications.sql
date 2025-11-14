-- Add Blog Comment Reply Notifications
-- This script adds notifications when Restaurant Owners reply to customer comments

-- 1. Add a new column to track which comment a reply is for
-- This should already exist from our previous work, but let's ensure it's there
ALTER TABLE IF EXISTS public.blog_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.blog_comments(id) ON DELETE CASCADE;

-- 2. Create a function to send notification when a Restaurant Owner replies to a comment
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

  -- Create personalized notification message
  v_notification_message := format(
    'The %s team replied to your comment on "%s". Click to read what they said!',
    COALESCE(v_restaurant_name, 'restaurant'),
    COALESCE(v_blog_title, 'our latest post')
  );

  -- Insert notification for the customer
  INSERT INTO public.customer_notifications (
    customer_id,
    order_id, -- NULL since this is not order-related
    title,
    message,
    status,
    blog_post_id
  )
  VALUES (
    v_customer_id,
    NULL, -- No order associated with blog comment notifications
    'Comment Reply',
    v_notification_message,
    'unread',
    NEW.blog_post_id -- Include the blog post ID
  );

  -- Return the new comment
  RETURN NEW;
END;
$$;

-- 3. Create trigger for blog comment replies
DROP TRIGGER IF EXISTS trg_blog_comment_reply_notification ON public.blog_comments;
CREATE TRIGGER trg_blog_comment_reply_notification
  AFTER INSERT ON public.blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_blog_comment_reply();

-- 4. Create index for better performance on customer notifications
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id_status
  ON public.customer_notifications (customer_id, status, created_at DESC);

-- 5. Test the trigger
-- You can test by inserting a reply comment:
-- INSERT INTO public.blog_comments (blog_post_id, customer_id, content, parent_comment_id)
-- VALUES ('your-blog-post-id', 'restaurant-owner-id', 'Thank you for your feedback!', 'customer-comment-id');

-- 6. Verify the setup
SELECT 'Setup complete. Blog comment reply notifications are now active.' as status;