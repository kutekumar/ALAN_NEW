-- Seed restaurants data
INSERT INTO public.restaurants (id, name, description, cuisine_type, address, phone, image_url, rating, distance, open_hours, owner_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Yangon Bistro', 'Contemporary Myanmar cuisine with a modern twist', 'Myanmar', 'Kabar Aye Pagoda Rd, Yangon', '+95 9 123 456 789', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800', 4.8, '2.3 km', '11:00 AM - 10:00 PM', '2609c710-5deb-4600-a9af-e21a056fabc8'),
  ('22222222-2222-2222-2222-222222222222', 'The Coffee House', 'Premium coffee and light bites in an elegant setting', 'Café', 'Inya Rd, Yangon', '+95 9 234 567 890', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800', 4.6, '1.5 km', '7:00 AM - 9:00 PM', NULL),
  ('33333333-3333-3333-3333-333333333333', 'Tokyo Bowl', 'Authentic Japanese ramen and sushi', 'Japanese', 'Shwedagon Pagoda Rd, Yangon', '+95 9 345 678 901', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800', 4.9, '3.1 km', '11:30 AM - 10:30 PM', NULL),
  ('44444444-4444-4444-4444-444444444444', 'Royal Thai Dine', 'Exquisite Thai flavors in a luxurious atmosphere', 'Thai', 'University Ave, Yangon', '+95 9 456 789 012', 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800', 4.7, '4.2 km', '12:00 PM - 11:00 PM', NULL)
ON CONFLICT (id) DO NOTHING;

-- Seed menu items data
INSERT INTO public.menu_items (id, restaurant_id, name, description, price, image_url, available) VALUES
  -- Yangon Bistro menu
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Traditional Mohinga', 'Rice noodles in fish broth with crispy fritters', 5000, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400', true),
  ('a1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Tea Leaf Salad', 'Fermented tea leaves with peanuts and tomatoes', 4500, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', true),
  ('a1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'Shan Noodles', 'Flat rice noodles with chicken in savory sauce', 5500, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400', true),
  
  -- The Coffee House menu
  ('a2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'Signature Latte', 'Smooth espresso with steamed milk', 3500, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', true),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Croissant', 'Buttery, flaky French pastry', 2500, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', true),
  
  -- Tokyo Bowl menu
  ('a3333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 'Tonkotsu Ramen', 'Rich pork broth with tender chashu', 8000, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400', true),
  ('a3333333-3333-3333-3333-333333333332', '33333333-3333-3333-3333-333333333333', 'Salmon Sushi Set', '8 pieces of fresh salmon nigiri', 12000, 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400', true),
  
  -- Royal Thai Dine menu
  ('a4444444-4444-4444-4444-444444444441', '44444444-4444-4444-4444-444444444444', 'Pad Thai', 'Stir-fried rice noodles with shrimp', 7000, 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400', true),
  ('a4444444-4444-4444-4444-444444444442', '44444444-4444-4444-4444-444444444444', 'Green Curry', 'Aromatic Thai curry with chicken', 7500, 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400', true)
ON CONFLICT (id) DO NOTHING;