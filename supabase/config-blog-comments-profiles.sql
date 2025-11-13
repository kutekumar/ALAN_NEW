-- Link blog_comments to profiles so we can show real customer names on blog comments
-- and avoid the "Guest XXXXX" fallback. This assumes:
--   profiles.id = auth.users.id  (standard Supabase pattern already used in your app).
-- Run this in Supabase SQL editor.

-- 1) Ensure customer_id matches profiles(id)
alter table if exists public.blog_comments
drop constraint if exists blog_comments_customer_id_fkey;

alter table public.blog_comments
add constraint blog_comments_customer_id_fkey
foreign key (customer_id)
references public.profiles (id)
on delete cascade;

-- 2) (Optional, but recommended) Index for faster joins/lookups
create index if not exists idx_blog_comments_customer_id
  on public.blog_comments (customer_id);

-- 3) Helper view to expose comments with profile data for reads
-- NOTE: Your profiles table does not have avatar_url; we only select full_name.
create or replace view public.v_blog_comments_with_profiles as
select
  c.id,
  c.blog_post_id,
  c.customer_id,
  c.content,
  c.is_edited,
  c.is_deleted,
  c.created_at,
  c.updated_at,
  p.full_name
from public.blog_comments c
left join public.profiles p
  on p.id = c.customer_id
where c.is_deleted = false;