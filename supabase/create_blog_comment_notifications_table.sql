-- Create Blog Comment Notifications Table for Restaurant Owners
-- This table stores notifications when customers comment on restaurant blog posts

-- 1. Create the blog_comment_notifications table
CREATE TABLE IF NOT EXISTS public.blog_comment_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blog_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    comment_id uuid NOT NULL REFERENCES public.blog_comments(id) ON DELETE CASCADE,
    title text DEFAULT 'New Blog Comment' NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'unread'::text NOT NULL CHECK (status IN ('unread', 'read')),
    created_at timestamptz DEFAULT now() NOT NULL,
    comment_content text,
    CONSTRAINT blog_comment_notifications_comment_id_unique UNIQUE (comment_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.blog_comment_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for blog comment notifications
CREATE POLICY "Restaurant owners can view their blog comment notifications" ON public.blog_comment_notifications
FOR ALL USING (restaurant_id IN (
    SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
));

CREATE POLICY "Restaurant owners can insert blog comment notifications" ON public.blog_comment_notifications
FOR INSERT WITH CHECK (restaurant_id IN (
    SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
));

CREATE POLICY "Restaurant owners can update their blog comment notifications" ON public.blog_comment_notifications
FOR UPDATE USING (restaurant_id IN (
    SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
));

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_comment_notifications_restaurant_id_status
ON public.blog_comment_notifications (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_comment_notifications_blog_post_id
ON public.blog_comment_notifications (blog_post_id);

CREATE INDEX IF NOT EXISTS idx_blog_comment_notifications_comment_id
ON public.blog_comment_notifications (comment_id);

-- 5. Create function to send notification when customer comments on blog post
CREATE OR REPLACE FUNCTION public.handle_blog_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restaurant_id uuid;
  v_restaurant_name text;
  v_customer_name text;
  v_blog_title text;
  v_notification_message text;
BEGIN
  -- Only process new comments (not replies - replies are handled separately)
  IF NEW.parent_comment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the restaurant ID for this blog post
  SELECT bp.restaurant_id INTO v_restaurant_id
  FROM public.blog_posts bp
  WHERE bp.id = NEW.blog_post_id;

  -- If we can't find the restaurant, exit
  IF v_restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get restaurant name
  SELECT r.name INTO v_restaurant_name
  FROM public.restaurants r
  WHERE r.id = v_restaurant_id;

  -- Get the customer's display name
  SELECT COALESCE(
    p.full_name,
    split_part(u.email, '@', 1)
  ) INTO v_customer_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = NEW.customer_id;

  -- Get the blog post title
  SELECT title INTO v_blog_title
  FROM public.blog_posts
  WHERE id = NEW.blog_post_id;

  -- Create notification message
  v_notification_message := format(
    '%s commented on your blog post "%s": "%s"',
    COALESCE(v_customer_name, 'A customer'),
    COALESCE(v_blog_title, 'a blog post'),
    -- Truncate comment content to 100 characters for notification preview
    CASE
      WHEN length(NEW.content) > 100 THEN left(NEW.content, 97) || '...'
      ELSE NEW.content
    END
  );

  -- Insert notification for the restaurant owner
  INSERT INTO public.blog_comment_notifications (
    restaurant_id,
    customer_id,
    blog_post_id,
    comment_id,
    title,
    message,
    status,
    comment_content
  )
  VALUES (
    v_restaurant_id,
    NEW.customer_id,
    NEW.blog_post_id,
    NEW.id,
    'New Blog Comment',
    v_notification_message,
    'unread',
    NEW.content
  );

  -- Return the new comment
  RETURN NEW;
END;
$$;

-- 6. Create trigger for blog comments
DROP TRIGGER IF EXISTS trg_blog_comment_notification ON public.blog_comments;
CREATE TRIGGER trg_blog_comment_notification
  AFTER INSERT ON public.blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_blog_comment_notification();

-- 7. Verify the setup
SELECT 'Blog comment notifications table and trigger created successfully' as status;