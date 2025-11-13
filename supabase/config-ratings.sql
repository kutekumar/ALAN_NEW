-- 1) Table to store individual customer ratings per restaurant/order
create table if not exists public.restaurant_ratings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  unique (restaurant_id, customer_id, order_id)
);

create index if not exists idx_restaurant_ratings_restaurant_id
  on public.restaurant_ratings (restaurant_id);

create index if not exists idx_restaurant_ratings_restaurant_customer
  on public.restaurant_ratings (restaurant_id, customer_id);

-- 2) Function to recalculate restaurant average rating (1-decimal) combining:
--    - manual rating (existing restaurants.rating column)
--    - customer ratings from restaurant_ratings
-- Behavior:
--    - If there are any customer ratings, use ONLY the average of customer ratings (1 decimal).
--    - If there are no customer ratings, keep existing restaurants.rating as-is
--      (so manual admin rating is preserved until first customer rating).
create or replace function public.recalculate_restaurant_rating(p_restaurant_id uuid)
returns void
language plpgsql
as $$
declare
  v_customer_avg numeric(3,2);
  v_final numeric(2,1);
begin
  -- Compute average from customer ratings, if any
  select avg(rating)::numeric(3,2)
  into v_customer_avg
  from public.restaurant_ratings
  where restaurant_id = p_restaurant_id;

  if v_customer_avg is not null then
    -- Round to 1 decimal place like 3.1, 3.2, etc.
    v_final := round(v_customer_avg * 10) / 10.0;
    update public.restaurants
    set rating = v_final
    where id = p_restaurant_id;
  end if;
  -- If no customer ratings exist, do nothing (manual admin rating stays)
end;
$$;

-- 3) Trigger: when inserting or updating a rating, refresh restaurant rating
create or replace function public.handle_restaurant_rating_change()
returns trigger
language plpgsql
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.recalculate_restaurant_rating(NEW.restaurant_id);
  elsif (TG_OP = 'UPDATE') then
    -- If restaurant_id changed, recalc both old and new
    if NEW.restaurant_id <> OLD.restaurant_id then
      perform public.recalculate_restaurant_rating(OLD.restaurant_id);
    end if;
    perform public.recalculate_restaurant_rating(NEW.restaurant_id);
  elsif (TG_OP = 'DELETE') then
    perform public.recalculate_restaurant_rating(OLD.restaurant_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_restaurant_ratings_change on public.restaurant_ratings;

create trigger trg_restaurant_ratings_change
after insert or update or delete on public.restaurant_ratings
for each row
execute function public.handle_restaurant_rating_change();

-- 4) Customer notification to prompt for rating when order is completed/served.
--    This reuses public.customer_notifications style.
--    Assumes orders table has: id, customer_id, restaurant_id, status.
create or replace function public.handle_order_status_rating_prompt()
returns trigger
language plpgsql
as $$
declare
  v_existing_rating_id uuid;
begin
  -- Only consider if order has a customer and restaurant
  if NEW.customer_id is null or NEW.restaurant_id is null then
    return NEW;
  end if;

  -- Fire when status becomes 'completed' or 'served'
  if (TG_OP = 'UPDATE')
     and (NEW.status in ('completed', 'served'))
     and (OLD.status is distinct from NEW.status) then

    -- Check if this customer already rated this restaurant for this order
    select id into v_existing_rating_id
    from public.restaurant_ratings
    where restaurant_id = NEW.restaurant_id
      and customer_id = NEW.customer_id
      and order_id = NEW.id
    limit 1;

    if v_existing_rating_id is null then
      -- Insert notification asking for rating
      insert into public.customer_notifications (
        customer_id,
        order_id,
        title,
        message,
        status
      )
      values (
        NEW.customer_id,
        NEW.id,
        'Your order is completed',
        'Your order is completed and it will be served in a short while. Please give us rating for our service.',
        'unread'
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_order_status_rating_prompt on public.orders;

create trigger trg_order_status_rating_prompt
after update on public.orders
for each row
execute function public.handle_order_status_rating_prompt();