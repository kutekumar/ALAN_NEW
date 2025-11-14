-- Add missing columns for reply functionality
-- Run this in Supabase SQL editor to add the required columns

-- Add parent_comment_id column if it doesn't exist
ALTER TABLE IF EXISTS public.blog_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.blog_comments(id) ON DELETE CASCADE;

-- Add index for better performance on parent_comment_id queries
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_comment_id
  ON public.blog_comments (parent_comment_id);