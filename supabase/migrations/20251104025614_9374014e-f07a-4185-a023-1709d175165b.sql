-- Add restaurant_owner role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'restaurant_owner';

-- For testing: Insert a restaurant owner role for yangonbistro@gmail.com
-- Note: This assumes the user already exists in auth.users
-- To create the test user, sign up with yangonbistro@gmail.com / bistro123 first
-- Then run this to assign the restaurant_owner role:

-- Uncomment and update user_id after creating the test user:
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'restaurant_owner'::app_role
-- FROM auth.users
-- WHERE email = 'yangonbistro@gmail.com'
-- ON CONFLICT (user_id, role) DO NOTHING;