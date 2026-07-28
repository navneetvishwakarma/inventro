-- S-02 seed data. Applied to local dev automatically on `supabase db reset`;
-- applied to the remote project manually once via
--   supabase db query -f supabase/seed.sql --linked
-- since there's no automatic remote-seed step in the CLI.
--
-- Placeholder household at the nil UUID, standing in for DEFAULT_HOUSEHOLD_ID
-- (an env constant per ADR-0004/working spec Sec2 — the app never generates
-- a household id at runtime in v1). S-04's onboarding wizard must UPDATE
-- this row in place (name, currency, timezone, monthly_budget, stock_epoch),
-- not INSERT a new household row, or the household_id every table below
-- points at goes stale.

insert into households (id, name, currency, timezone, stock_epoch, is_demo)
values ('00000000-0000-0000-0000-000000000000', 'Household', 'INR', 'Asia/Kolkata', now(), false);

-- categories: 16 top-level + sub-categories (working spec Sec6). default_prior_days
-- calibrated against test-plan.md's anchor points (milk ~2d, rice ~45d, detergent ~60d)
-- and general Indian-household consumption patterns — spot-check before treating as final.

with top as (
  insert into categories (name, slug, default_base_unit, default_prior_days, is_system) values
    ('Groceries & Staples', 'groceries-staples', 'g', 30, true),
    ('Fresh', 'fresh', 'g', 5, true),
    ('Dairy & Eggs', 'dairy-eggs', 'ml', 5, true),
    ('Bakery & Breakfast', 'bakery-breakfast', 'g', 10, true),
    ('Beverages', 'beverages', 'ml', 15, true),
    ('Packaged & Instant', 'packaged-instant', 'g', 20, true),
    ('Snacks & Confectionery', 'snacks-confectionery', 'g', 10, true),
    ('Meat & Seafood', 'meat-seafood', 'g', 7, true),
    ('Home Care', 'home-care', 'piece', 45, true),
    ('Personal Care', 'personal-care', 'piece', 35, true),
    ('Baby & Kids', 'baby-kids', 'piece', 14, true),
    ('Health', 'health', 'piece', 30, true),
    ('Pet Supplies', 'pet-supplies', 'g', 25, true),
    ('Utilities & Refills', 'utilities-refills', 'piece', 30, true),
    ('Kitchen & Household Goods', 'kitchen-household-goods', 'piece', 180, true),
    ('Stationery & Misc', 'stationery-misc', 'piece', 60, true)
  returning id, slug
)
insert into categories (parent_id, name, slug, default_base_unit, default_prior_days, is_system)
select t.id, sub.name, sub.slug, sub.unit, sub.prior_days, true
from top t
join (values
  -- Groceries & Staples
  ('groceries-staples', 'Grains & Flour', 'grains-flour', 'g'::base_unit_type, 45),
  ('groceries-staples', 'Pulses & Lentils', 'pulses-lentils', 'g', 30),
  ('groceries-staples', 'Cooking Oil & Ghee', 'cooking-oil-ghee', 'ml', 30),
  ('groceries-staples', 'Spices & Masala', 'spices-masala', 'g', 60),
  ('groceries-staples', 'Sugar & Salt', 'sugar-salt', 'g', 30),
  ('groceries-staples', 'Dry Fruits & Nuts', 'dry-fruits-nuts', 'g', 45),
  -- Fresh
  ('fresh', 'Vegetables', 'vegetables', 'g', 5),
  ('fresh', 'Fruits', 'fruits', 'g', 6),
  ('fresh', 'Herbs & Greens', 'herbs-greens', 'g', 4),
  -- Dairy & Eggs
  ('dairy-eggs', 'Milk', 'milk', 'ml', 2),
  ('dairy-eggs', 'Curd & Yogurt', 'curd-yogurt', 'g', 3),
  ('dairy-eggs', 'Paneer & Cheese', 'paneer-cheese', 'g', 7),
  ('dairy-eggs', 'Butter', 'butter', 'g', 20),
  ('dairy-eggs', 'Eggs', 'eggs', 'piece', 10),
  -- Bakery & Breakfast
  ('bakery-breakfast', 'Bread', 'bread', 'piece', 4),
  ('bakery-breakfast', 'Biscuits & Cookies', 'biscuits-cookies', 'g', 12),
  ('bakery-breakfast', 'Cereal', 'cereal', 'g', 20),
  ('bakery-breakfast', 'Spreads & Jam', 'spreads-jam', 'g', 30),
  -- Beverages
  ('beverages', 'Tea & Coffee', 'tea-coffee', 'g', 25),
  ('beverages', 'Juices', 'juices', 'ml', 10),
  ('beverages', 'Soft Drinks', 'soft-drinks', 'ml', 12),
  ('beverages', 'Water', 'water-bottled', 'ml', 15),
  -- Packaged & Instant
  ('packaged-instant', 'Noodles & Pasta', 'noodles-pasta', 'g', 15),
  ('packaged-instant', 'Sauces & Condiments', 'sauces-condiments', 'ml', 25),
  ('packaged-instant', 'Ready-to-Eat', 'ready-to-eat', 'piece', 10),
  ('packaged-instant', 'Canned', 'canned', 'piece', 20),
  -- Snacks & Confectionery
  ('snacks-confectionery', 'Namkeen & Chips', 'namkeen-chips', 'g', 8),
  ('snacks-confectionery', 'Chocolates & Sweets', 'chocolates-sweets', 'g', 10),
  -- Meat & Seafood
  ('meat-seafood', 'Chicken', 'chicken', 'g', 6),
  ('meat-seafood', 'Mutton', 'mutton', 'g', 10),
  ('meat-seafood', 'Fish', 'fish', 'g', 6),
  ('meat-seafood', 'Frozen', 'frozen-meat-seafood', 'g', 15),
  -- Home Care
  ('home-care', 'Laundry', 'laundry', 'g', 60),
  ('home-care', 'Dishwashing', 'dishwashing', 'ml', 30),
  ('home-care', 'Floor & Surface', 'floor-surface', 'ml', 30),
  ('home-care', 'Pest Control', 'pest-control', 'piece', 60),
  ('home-care', 'Tissue & Foil', 'tissue-foil', 'piece', 25),
  -- Personal Care
  ('personal-care', 'Hair', 'hair-care', 'ml', 30),
  ('personal-care', 'Skin', 'skin-care', 'ml', 30),
  ('personal-care', 'Oral', 'oral-care', 'piece', 45),
  ('personal-care', 'Bath & Soap', 'bath-soap', 'piece', 20),
  ('personal-care', 'Shaving & Grooming', 'shaving-grooming', 'piece', 45),
  ('personal-care', 'Feminine Care', 'feminine-care', 'piece', 28),
  ('personal-care', 'Deodorant', 'deodorant', 'piece', 45),
  -- Baby & Kids
  ('baby-kids', 'Diapers', 'diapers', 'piece', 7),
  ('baby-kids', 'Baby Food', 'baby-food', 'g', 10),
  ('baby-kids', 'Baby Care', 'baby-care', 'ml', 30),
  -- Health
  ('health', 'Medicines', 'medicines', 'piece', 30),
  ('health', 'Supplements', 'supplements', 'piece', 30),
  ('health', 'First Aid', 'first-aid', 'piece', 90),
  -- Pet Supplies
  ('pet-supplies', 'Pet Food', 'pet-food', 'g', 20),
  ('pet-supplies', 'Pet Care', 'pet-care', 'piece', 45),
  -- Utilities & Refills
  ('utilities-refills', 'LPG', 'lpg', 'piece', 45),
  ('utilities-refills', 'Water Can', 'water-can', 'piece', 7),
  ('utilities-refills', 'Gas/Electric', 'gas-electric', 'piece', 30),
  -- Kitchen & Household Goods
  ('kitchen-household-goods', 'Utensils', 'utensils', 'piece', 180),
  ('kitchen-household-goods', 'Storage', 'storage', 'piece', 180),
  ('kitchen-household-goods', 'Small Appliances', 'small-appliances', 'piece', 365),
  -- Stationery & Misc
  ('stationery-misc', 'Uncategorized', 'uncategorized', 'piece', 60)
) as sub(parent_slug, name, slug, unit, prior_days) on sub.parent_slug = t.slug;

-- catalog_items: starter catalog for common Indian-household grocery/supply
-- items, curated (not generated) across every leaf category above. All
-- attached to the placeholder household (see note at top of this file).
-- perishability_days is a per-item override; category default_prior_days
-- remains the cold-start fallback for items not yet in this catalog.

insert into catalog_items (household_id, canonical_name, brand, category_id, base_unit, default_pack_size, perishability_days, is_staple)
select '00000000-0000-0000-0000-000000000000', v.name, nullif(v.brand, 'Generic'), c.id, v.unit, v.pack_size, v.prior_days, v.is_staple
from (values
  -- Grains & Flour
  ('grains-flour', 'Basmati Rice', 'India Gate', 'g'::base_unit_type, 1000::numeric, 45, true),
  ('grains-flour', 'Sona Masoori Rice', 'Generic', 'g', 1000, 45, true),
  ('grains-flour', 'Idli Rice', 'Generic', 'g', 1000, 45, false),
  ('grains-flour', 'Wheat Flour (Atta)', 'Aashirvaad', 'g', 1000, 30, true),
  ('grains-flour', 'Wheat Flour (Atta)', 'Pillsbury', 'g', 1000, 30, false),
  ('grains-flour', 'Semolina (Rava/Sooji)', 'Generic', 'g', 500, 45, false),
  ('grains-flour', 'Poha (Flattened Rice)', 'Generic', 'g', 500, 60, false),
  ('grains-flour', 'Sabudana (Sago)', 'Generic', 'g', 500, 90, false),
  ('grains-flour', 'Maida (Refined Flour)', 'Generic', 'g', 500, 60, false),
  ('grains-flour', 'Brown Rice', 'Generic', 'g', 1000, 45, false),
  ('grains-flour', 'Vermicelli', 'Bambino', 'g', 200, 90, false),
  -- Pulses & Lentils
  ('pulses-lentils', 'Toor Dal', 'Generic', 'g', 1000, 30, true),
  ('pulses-lentils', 'Moong Dal', 'Generic', 'g', 1000, 30, true),
  ('pulses-lentils', 'Chana Dal', 'Generic', 'g', 1000, 30, false),
  ('pulses-lentils', 'Urad Dal', 'Generic', 'g', 500, 45, false),
  ('pulses-lentils', 'Masoor Dal', 'Generic', 'g', 500, 45, false),
  ('pulses-lentils', 'Rajma (Kidney Beans)', 'Generic', 'g', 500, 60, false),
  ('pulses-lentils', 'Chana (Kabuli/Chickpeas)', 'Generic', 'g', 500, 60, false),
  ('pulses-lentils', 'Green Moong Whole', 'Generic', 'g', 500, 60, false),
  ('pulses-lentils', 'Black Chana', 'Generic', 'g', 500, 60, false),
  -- Cooking Oil & Ghee
  ('cooking-oil-ghee', 'Sunflower Oil', 'Fortune', 'ml', 1000, 30, true),
  ('cooking-oil-ghee', 'Mustard Oil', 'Fortune', 'ml', 1000, 45, false),
  ('cooking-oil-ghee', 'Groundnut Oil', 'Generic', 'ml', 1000, 30, false),
  ('cooking-oil-ghee', 'Refined Oil', 'Saffola', 'ml', 1000, 30, true),
  ('cooking-oil-ghee', 'Ghee', 'Amul', 'ml', 500, 60, true),
  ('cooking-oil-ghee', 'Coconut Oil', 'Parachute', 'ml', 500, 60, false),
  ('cooking-oil-ghee', 'Olive Oil', 'Figaro', 'ml', 500, 90, false),
  ('cooking-oil-ghee', 'Rice Bran Oil', 'Fortune', 'ml', 1000, 30, false),
  -- Spices & Masala
  ('spices-masala', 'Turmeric Powder', 'Everest', 'g', 200, 60, true),
  ('spices-masala', 'Red Chilli Powder', 'Everest', 'g', 200, 60, true),
  ('spices-masala', 'Coriander Powder', 'Everest', 'g', 200, 60, false),
  ('spices-masala', 'Garam Masala', 'MDH', 'g', 100, 60, true),
  ('spices-masala', 'Cumin Seeds', 'Generic', 'g', 100, 90, false),
  ('spices-masala', 'Mustard Seeds', 'Generic', 'g', 100, 90, false),
  ('spices-masala', 'Black Pepper', 'Generic', 'g', 100, 90, false),
  ('spices-masala', 'Biryani Masala', 'Everest', 'g', 100, 60, false),
  ('spices-masala', 'Sambar Powder', 'MTR', 'g', 200, 60, false),
  ('spices-masala', 'Hing (Asafoetida)', 'Generic', 'g', 50, 120, false),
  ('spices-masala', 'Chaat Masala', 'MDH', 'g', 100, 90, false),
  ('spices-masala', 'Kitchen King Masala', 'MDH', 'g', 100, 60, false),
  ('spices-masala', 'Fennel Seeds (Saunf)', 'Generic', 'g', 100, 90, false),
  ('spices-masala', 'Carom Seeds (Ajwain)', 'Generic', 'g', 100, 90, false),
  -- Sugar & Salt
  ('sugar-salt', 'Sugar', 'Generic', 'g', 1000, 30, true),
  ('sugar-salt', 'Salt', 'Tata', 'g', 1000, 60, true),
  ('sugar-salt', 'Jaggery', 'Generic', 'g', 500, 60, false),
  ('sugar-salt', 'Brown Sugar', 'Generic', 'g', 500, 45, false),
  -- Dry Fruits & Nuts
  ('dry-fruits-nuts', 'Almonds', 'Generic', 'g', 250, 60, false),
  ('dry-fruits-nuts', 'Cashews', 'Generic', 'g', 250, 60, false),
  ('dry-fruits-nuts', 'Raisins', 'Generic', 'g', 200, 60, false),
  ('dry-fruits-nuts', 'Walnuts', 'Generic', 'g', 250, 60, false),
  ('dry-fruits-nuts', 'Pistachios', 'Generic', 'g', 250, 60, false),
  ('dry-fruits-nuts', 'Dates', 'Generic', 'g', 500, 90, false),
  -- Vegetables
  ('vegetables', 'Onion', 'Generic', 'g', 1000, 10, true),
  ('vegetables', 'Potato', 'Generic', 'g', 1000, 14, true),
  ('vegetables', 'Tomato', 'Generic', 'g', 500, 5, true),
  ('vegetables', 'Garlic', 'Generic', 'g', 250, 20, false),
  ('vegetables', 'Ginger', 'Generic', 'g', 250, 12, false),
  ('vegetables', 'Capsicum', 'Generic', 'g', 250, 5, false),
  ('vegetables', 'Cauliflower', 'Generic', 'g', 500, 5, false),
  ('vegetables', 'Cabbage', 'Generic', 'g', 500, 7, false),
  ('vegetables', 'Carrot', 'Generic', 'g', 500, 7, false),
  ('vegetables', 'Beans', 'Generic', 'g', 250, 4, false),
  ('vegetables', 'Brinjal', 'Generic', 'g', 500, 5, false),
  ('vegetables', 'Cucumber', 'Generic', 'g', 500, 5, false),
  ('vegetables', 'Lady Finger (Bhindi)', 'Generic', 'g', 250, 4, false),
  ('vegetables', 'Green Chilli', 'Generic', 'g', 100, 6, false),
  ('vegetables', 'Peas', 'Generic', 'g', 250, 5, false),
  ('vegetables', 'Beetroot', 'Generic', 'g', 250, 8, false),
  ('vegetables', 'Radish', 'Generic', 'g', 250, 6, false),
  ('vegetables', 'Pumpkin', 'Generic', 'g', 500, 10, false),
  ('vegetables', 'Bottle Gourd (Lauki)', 'Generic', 'g', 500, 5, false),
  ('vegetables', 'Ridge Gourd (Turai)', 'Generic', 'g', 500, 5, false),
  -- Fruits
  ('fruits', 'Banana', 'Generic', 'piece', 6, 4, true),
  ('fruits', 'Apple', 'Generic', 'g', 1000, 10, true),
  ('fruits', 'Orange', 'Generic', 'g', 1000, 10, false),
  ('fruits', 'Mango', 'Generic', 'g', 1000, 6, false),
  ('fruits', 'Grapes', 'Generic', 'g', 500, 5, false),
  ('fruits', 'Papaya', 'Generic', 'piece', 1, 5, false),
  ('fruits', 'Watermelon', 'Generic', 'piece', 1, 6, false),
  ('fruits', 'Pomegranate', 'Generic', 'g', 500, 10, false),
  ('fruits', 'Guava', 'Generic', 'g', 500, 7, false),
  ('fruits', 'Pineapple', 'Generic', 'piece', 1, 6, false),
  ('fruits', 'Kiwi', 'Generic', 'piece', 4, 8, false),
  ('fruits', 'Sweet Lime (Mosambi)', 'Generic', 'g', 1000, 8, false),
  -- Herbs & Greens
  ('herbs-greens', 'Coriander Leaves', 'Generic', 'g', 100, 3, true),
  ('herbs-greens', 'Mint Leaves', 'Generic', 'g', 100, 3, false),
  ('herbs-greens', 'Curry Leaves', 'Generic', 'g', 50, 5, false),
  ('herbs-greens', 'Spinach (Palak)', 'Generic', 'g', 250, 4, false),
  ('herbs-greens', 'Fenugreek Leaves (Methi)', 'Generic', 'g', 250, 4, false),
  -- Milk
  ('milk', 'Full Cream Milk', 'Amul', 'ml', 500, 2, true),
  ('milk', 'Toned Milk', 'Amul', 'ml', 500, 2, true),
  ('milk', 'Double Toned Milk', 'Mother Dairy', 'ml', 500, 2, false),
  ('milk', 'Full Cream Milk', 'Mother Dairy', 'ml', 1000, 2, false),
  ('milk', 'Almond Milk', 'Generic', 'ml', 1000, 10, false),
  -- Curd & Yogurt
  ('curd-yogurt', 'Curd', 'Amul', 'g', 400, 3, true),
  ('curd-yogurt', 'Curd', 'Mother Dairy', 'g', 400, 3, false),
  ('curd-yogurt', 'Flavoured Yogurt', 'Epigamia', 'g', 90, 7, false),
  ('curd-yogurt', 'Greek Yogurt', 'Epigamia', 'g', 400, 7, false),
  -- Paneer & Cheese
  ('paneer-cheese', 'Paneer', 'Amul', 'g', 200, 5, true),
  ('paneer-cheese', 'Processed Cheese Slices', 'Amul', 'g', 200, 45, false),
  ('paneer-cheese', 'Cheese Cubes', 'Britannia', 'g', 200, 45, false),
  ('paneer-cheese', 'Mozzarella Cheese', 'Go', 'g', 200, 30, false),
  -- Butter
  ('butter', 'Salted Butter', 'Amul', 'g', 500, 30, true),
  ('butter', 'Unsalted Butter', 'Amul', 'g', 100, 30, false),
  ('butter', 'Table Spread', 'Nutralite', 'g', 200, 45, false),
  -- Eggs
  ('eggs', 'Eggs (6-pack)', 'Generic', 'piece', 6, 10, true),
  ('eggs', 'Eggs (12-pack)', 'Generic', 'piece', 12, 10, true),
  ('eggs', 'Eggs (30-pack/tray)', 'Generic', 'piece', 30, 12, false),
  -- Bread
  ('bread', 'White Bread', 'Britannia', 'piece', 1, 4, true),
  ('bread', 'Brown Bread', 'Britannia', 'piece', 1, 4, true),
  ('bread', 'Multigrain Bread', 'Harvest Gold', 'piece', 1, 4, false),
  ('bread', 'Bun/Pav', 'Generic', 'piece', 6, 3, false),
  -- Biscuits & Cookies
  ('biscuits-cookies', 'Marie Biscuits', 'Britannia', 'g', 250, 30, true),
  ('biscuits-cookies', 'Parle-G', 'Parle', 'g', 250, 30, true),
  ('biscuits-cookies', 'Cream Biscuits', 'Oreo', 'g', 120, 30, false),
  ('biscuits-cookies', 'Digestive Biscuits', 'McVitie''s', 'g', 250, 45, false),
  ('biscuits-cookies', 'Cookies', 'Sunfeast', 'g', 300, 30, false),
  -- Cereal
  ('cereal', 'Cornflakes', 'Kellogg''s', 'g', 500, 30, false),
  ('cereal', 'Oats', 'Saffola', 'g', 1000, 45, true),
  ('cereal', 'Muesli', 'Bagrry''s', 'g', 500, 45, false),
  ('cereal', 'Chocos', 'Kellogg''s', 'g', 500, 30, false),
  -- Spreads & Jam
  ('spreads-jam', 'Mixed Fruit Jam', 'Kissan', 'g', 500, 60, false),
  ('spreads-jam', 'Peanut Butter', 'Pintola', 'g', 500, 60, false),
  ('spreads-jam', 'Chocolate Spread', 'Nutella', 'g', 350, 60, false),
  ('spreads-jam', 'Honey', 'Dabur', 'g', 500, 90, false),
  -- Tea & Coffee
  ('tea-coffee', 'Tea Leaves', 'Tata', 'g', 500, 30, true),
  ('tea-coffee', 'Tea Bags', 'Lipton', 'g', 100, 45, false),
  ('tea-coffee', 'Instant Coffee', 'Nescafe', 'g', 100, 45, true),
  ('tea-coffee', 'Filter Coffee Powder', 'Bru', 'g', 200, 45, false),
  ('tea-coffee', 'Green Tea', 'Lipton', 'g', 100, 60, false),
  -- Juices
  ('juices', 'Mango Juice', 'Real', 'ml', 1000, 15, false),
  ('juices', 'Mixed Fruit Juice', 'Tropicana', 'ml', 1000, 15, false),
  ('juices', 'Orange Juice', 'Real', 'ml', 1000, 15, false),
  -- Soft Drinks
  ('soft-drinks', 'Cola', 'Coca-Cola', 'ml', 1500, 20, false),
  ('soft-drinks', 'Lemon Soda', 'Sprite', 'ml', 1500, 20, false),
  ('soft-drinks', 'Orange Soda', 'Fanta', 'ml', 1500, 20, false),
  -- Water
  ('water-bottled', 'Mineral Water Bottle 1L', 'Bisleri', 'ml', 1000, 15, false),
  ('water-bottled', 'Mineral Water Bottle 2L', 'Bisleri', 'ml', 2000, 15, false),
  ('water-bottled', 'Mineral Water Can (20L)', 'Bisleri', 'ml', 20000, 10, true),
  -- Noodles & Pasta
  ('noodles-pasta', 'Instant Noodles', 'Maggi', 'g', 280, 20, true),
  ('noodles-pasta', 'Pasta', 'Generic', 'g', 500, 60, false),
  ('noodles-pasta', 'Macaroni', 'Generic', 'g', 500, 60, false),
  ('noodles-pasta', 'Vermicelli (Semiya)', 'Bambino', 'g', 200, 90, false),
  -- Sauces & Condiments
  ('sauces-condiments', 'Tomato Ketchup', 'Kissan', 'ml', 500, 45, true),
  ('sauces-condiments', 'Soy Sauce', 'Generic', 'ml', 200, 60, false),
  ('sauces-condiments', 'Chilli Sauce', 'Ching''s', 'ml', 200, 60, false),
  ('sauces-condiments', 'Mayonnaise', 'Veeba', 'ml', 250, 30, false),
  ('sauces-condiments', 'Vinegar', 'Generic', 'ml', 500, 90, false),
  -- Ready-to-Eat
  ('ready-to-eat', 'Instant Upma Mix', 'MTR', 'piece', 1, 45, false),
  ('ready-to-eat', 'Ready Meals (Paneer Butter Masala)', 'MTR', 'piece', 1, 20, false),
  ('ready-to-eat', 'Poha Mix', 'MTR', 'piece', 1, 45, false),
  ('ready-to-eat', 'Idli Batter', 'iD', 'piece', 1, 5, false),
  -- Canned
  ('canned', 'Canned Beans', 'Generic', 'piece', 1, 180, false),
  ('canned', 'Canned Corn', 'Del Monte', 'piece', 1, 180, false),
  ('canned', 'Canned Tomato Puree', 'Generic', 'piece', 1, 90, false),
  -- Namkeen & Chips
  ('namkeen-chips', 'Potato Chips', 'Lay''s', 'g', 150, 10, false),
  ('namkeen-chips', 'Mixture Namkeen', 'Haldiram''s', 'g', 200, 15, false),
  ('namkeen-chips', 'Bhujia', 'Haldiram''s', 'g', 200, 15, false),
  ('namkeen-chips', 'Popcorn', 'Act II', 'g', 100, 20, false),
  ('namkeen-chips', 'Roasted Peanuts', 'Generic', 'g', 250, 30, false),
  -- Chocolates & Sweets
  ('chocolates-sweets', 'Chocolate Bar', 'Cadbury Dairy Milk', 'g', 100, 30, false),
  ('chocolates-sweets', 'Candy', 'Generic', 'g', 100, 30, false),
  ('chocolates-sweets', 'Indian Sweets (Mithai)', 'Generic', 'g', 250, 7, false),
  ('chocolates-sweets', 'Chewing Gum', 'Orbit', 'g', 50, 60, false),
  -- Meat
  ('chicken', 'Chicken Curry Cut', 'Generic', 'g', 500, 3, true),
  ('chicken', 'Chicken Breast', 'Generic', 'g', 500, 3, false),
  ('mutton', 'Mutton Curry Cut', 'Generic', 'g', 500, 3, false),
  ('fish', 'Pomfret', 'Generic', 'g', 500, 2, false),
  ('fish', 'Rohu', 'Generic', 'g', 500, 2, false),
  ('frozen-meat-seafood', 'Frozen Peas', 'Generic', 'g', 500, 90, false),
  ('frozen-meat-seafood', 'Frozen Chicken Nuggets', 'Sumeru', 'g', 500, 90, false),
  ('frozen-meat-seafood', 'Frozen Paratha', 'Generic', 'g', 400, 60, false),
  -- Home Care
  ('laundry', 'Detergent Powder', 'Surf Excel', 'g', 1000, 60, true),
  ('laundry', 'Liquid Detergent', 'Ariel', 'g', 1000, 60, false),
  ('laundry', 'Fabric Softener', 'Comfort', 'g', 860, 60, false),
  ('dishwashing', 'Dishwash Liquid', 'Vim', 'ml', 500, 30, true),
  ('dishwashing', 'Dishwash Bar', 'Vim', 'g', 200, 30, false),
  ('floor-surface', 'Floor Cleaner', 'Lizol', 'ml', 975, 30, false),
  ('floor-surface', 'Glass Cleaner', 'Colin', 'ml', 500, 45, false),
  ('floor-surface', 'Toilet Cleaner', 'Harpic', 'ml', 500, 45, false),
  ('pest-control', 'Mosquito Repellent (Liquid Refill)', 'Good Knight', 'piece', 1, 45, false),
  ('pest-control', 'Cockroach Spray', 'HIT', 'piece', 1, 90, false),
  ('tissue-foil', 'Tissue Paper Roll', 'Origami', 'piece', 1, 20, false),
  ('tissue-foil', 'Aluminium Foil', 'Freshwrapp', 'piece', 1, 90, false),
  ('tissue-foil', 'Cling Wrap', 'Freshwrapp', 'piece', 1, 90, false),
  ('tissue-foil', 'Paper Towel', 'Origami', 'piece', 1, 20, false),
  -- Personal Care
  ('hair-care', 'Shampoo', 'Head & Shoulders', 'ml', 340, 30, true),
  ('hair-care', 'Conditioner', 'Dove', 'ml', 335, 30, false),
  ('hair-care', 'Hair Oil', 'Parachute', 'ml', 200, 45, false),
  ('skin-care', 'Face Wash', 'Himalaya', 'ml', 100, 45, false),
  ('skin-care', 'Body Lotion', 'Nivea', 'ml', 400, 60, false),
  ('skin-care', 'Sunscreen', 'Lakme', 'ml', 100, 60, false),
  ('skin-care', 'Face Cream', 'Ponds', 'ml', 100, 60, false),
  ('skin-care', 'Talcum Powder', 'Nycil', 'g', 100, 60, false),
  ('oral-care', 'Toothpaste', 'Colgate', 'piece', 1, 45, true),
  ('oral-care', 'Toothbrush', 'Colgate', 'piece', 1, 90, false),
  ('oral-care', 'Mouthwash', 'Listerine', 'piece', 1, 60, false),
  ('bath-soap', 'Bathing Soap', 'Dove', 'piece', 3, 20, true),
  ('bath-soap', 'Body Wash', 'Dettol', 'piece', 1, 30, false),
  ('bath-soap', 'Handwash', 'Dettol', 'piece', 1, 25, false),
  ('shaving-grooming', 'Razor', 'Gillette', 'piece', 1, 45, false),
  ('shaving-grooming', 'Shaving Cream', 'Gillette', 'piece', 1, 60, false),
  ('shaving-grooming', 'Aftershave', 'Old Spice', 'piece', 1, 60, false),
  ('feminine-care', 'Sanitary Pads', 'Whisper', 'piece', 1, 28, true),
  ('feminine-care', 'Tampons', 'Stayfree', 'piece', 1, 28, false),
  ('deodorant', 'Deodorant Spray', 'Axe', 'piece', 1, 45, false),
  ('deodorant', 'Roll-On Deodorant', 'Nivea', 'piece', 1, 45, false),
  ('deodorant', 'Perfume', 'Fogg', 'piece', 1, 90, false),
  -- Baby & Kids
  ('diapers', 'Baby Diapers', 'Pampers', 'piece', 1, 7, true),
  ('baby-food', 'Infant Formula', 'Nestle', 'g', 400, 20, false),
  ('baby-food', 'Cerelac', 'Nestle', 'g', 300, 20, false),
  ('baby-care', 'Baby Lotion', 'Johnson''s', 'ml', 200, 45, false),
  ('baby-care', 'Baby Powder', 'Johnson''s', 'g', 200, 60, false),
  ('baby-care', 'Baby Wipes', 'Himalaya', 'piece', 1, 20, false),
  -- Health
  ('medicines', 'Paracetamol', 'Crocin', 'piece', 1, 60, false),
  ('medicines', 'Antacid', 'ENO', 'piece', 1, 60, false),
  ('supplements', 'Multivitamin', 'Revital', 'piece', 1, 45, false),
  ('supplements', 'Protein Powder', 'Generic', 'piece', 1, 45, false),
  ('first-aid', 'Band-Aid', 'Johnson & Johnson', 'piece', 1, 120, false),
  ('first-aid', 'Antiseptic Liquid', 'Dettol', 'piece', 1, 90, false),
  -- Pet Supplies
  ('pet-food', 'Dog Food', 'Pedigree', 'g', 1000, 30, false),
  ('pet-food', 'Cat Food', 'Whiskas', 'g', 1000, 30, false),
  ('pet-care', 'Pet Shampoo', 'Generic', 'piece', 1, 60, false),
  ('pet-care', 'Pet Litter', 'Generic', 'piece', 1, 30, false),
  -- Utilities & Refills
  ('lpg', 'LPG Cylinder Refill', 'Generic', 'piece', 1, 45, true),
  ('water-can', 'Water Can (20L Refill)', 'Generic', 'piece', 1, 7, true),
  ('gas-electric', 'Gas Lighter Refill', 'Generic', 'piece', 1, 90, false),
  ('gas-electric', 'Inverter Battery Water', 'Generic', 'piece', 1, 180, false),
  -- Kitchen & Household Goods
  ('utensils', 'Steel Utensils Set', 'Generic', 'piece', 1, 365, false),
  ('utensils', 'Non-Stick Pan', 'Generic', 'piece', 1, 365, false),
  ('storage', 'Storage Containers Set', 'Generic', 'piece', 1, 365, false),
  ('storage', 'Ziplock Bags', 'Generic', 'piece', 1, 90, false),
  ('small-appliances', 'Mixer Grinder', 'Generic', 'piece', 1, 365, false),
  ('small-appliances', 'Electric Kettle', 'Generic', 'piece', 1, 365, false),
  -- Stationery & Misc
  ('uncategorized', 'Candles', 'Generic', 'piece', 1, 90, false),
  ('uncategorized', 'Matchbox', 'Generic', 'piece', 1, 60, false),
  ('uncategorized', 'Batteries (AA)', 'Generic', 'piece', 4, 90, false)
) as v(category_slug, name, brand, unit, pack_size, prior_days, is_staple)
join categories c on c.slug = v.category_slug;
