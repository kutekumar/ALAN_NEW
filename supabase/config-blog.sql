-- Blog + Comments schema for ALAN LUX BOOKING
-- Carefully designed to integrate with existing auth.users, restaurants, and menu items
-- No breaking changes to existing schema; all references are additive and nullable where needed.

-- 1) Blog posts authored by restaurant owners
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete set null,
  title text not null,
  slug text generated always as (
    lower(
      regexp_replace(
        coalesce(title, ''),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    )
  ) stored,
  content text not null,
  -- A short teaser/preview shown in listings for elegant minimalist cards
  excerpt text,
  -- Optional hero/cover image for the post
  hero_image_url text,
  -- Whether the post is visible to customers
  is_published boolean not null default true,
  -- Highlight promotional / menu announcement posts
  is_pinned boolean not null default false,
  -- Track linkage to existing menu items (via separate junction table, see below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_restaurant_created_at
  on public.blog_posts (restaurant_id, created_at desc);

create index if not exists idx_blog_posts_published_created_at
  on public.blog_posts (is_published, created_at desc);

-- 2) Optional mapping of blog posts to existing menu items
-- This allows owners to attach already configured menu images/details without schema conflicts.
create table if not exists public.blog_post_menu_items (
  blog_post_id uuid not null references public.blog_posts(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  primary key (blog_post_id, menu_item_id)
);

-- 3) Blog images table (reusable, but keeps flexibility)
-- Stores additional images an owner wants to show inside the post;
-- Typically these can reference existing file URLs already used for menus.
create table if not exists public.blog_post_images (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid not null references public.blog_posts(id) on delete cascade,
  image_url text not null,
  -- Optional: small caption under the image
  caption text,
  position integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_blog_post_images_blog_post_id_position
  on public.blog_post_images (blog_post_id, coalesce(position, 0), created_at);

-- 4) Comments from customers on blog posts
-- Customers can give feedback under each blog entry.
create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid not null references public.blog_posts(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  -- Support for replies to comments
  parent_comment_id uuid references public.blog_comments(id) on delete cascade,
  is_reply boolean not null default false,
  -- Soft moderation flags without deleting data
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_comments_post_created_at
  on public.blog_comments (blog_post_id, created_at asc);

create index if not exists idx_blog_comments_customer
  on public.blog_comments (customer_id, created_at desc);

-- 5) Simple RLS-friendly views (optional, non-breaking)
-- View to expose only published posts to customers.
create or replace view public.v_published_blog_posts as
select
  bp.*
from public.blog_posts bp
where bp.is_published = true;

-- 6) Basic trigger to keep updated_at in sync
create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_set_updated_at on public.blog_posts;
create trigger trg_blog_posts_set_updated_at
before update on public.blog_posts
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists trg_blog_comments_set_updated_at on public.blog_comments;
create trigger trg_blog_comments_set_updated_at
before update on public.blog_comments
for each row
execute function public.set_timestamp_updated_at();