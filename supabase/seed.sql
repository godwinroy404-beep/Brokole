-- ============================================================================
-- Brokole ERP - seed
-- The 18 meals currently live on the storefront, with their real prices and
-- macros. Idempotent: safe to run repeatedly.
-- ============================================================================

insert into public.categories (slug, name, sort_order) values
  ('grain-protein-bowls', 'Grain & Protein Bowls', 10),
  ('wraps',               'Wraps',                 20),
  ('salads-bowls',        'Salads & Bowls',        30),
  ('smoothies-juices',    'Smoothies & Juices',    40),
  ('breakfast',           'Breakfast',             50),
  ('snacks-sides',        'Snacks & Sides',        60)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

with data(slug, name, category_slug, price, kcal, protein, carbs, fat, fiber, popular, sort_order) as (
  values
    -- Grain & Protein Bowls
    ('quinoa-paneer-bowl',            'Quinoa Paneer Bowl',                    'grain-protein-bowls', 160.00, 460, 32, 45, 15, 8, true,  10),
    ('grilled-chicken-brown-rice',    'Grilled Chicken & Brown Rice',          'grain-protein-bowls', 180.00, 520, 38, 45, 12, 6, true,  20),
    ('paneer-tikka-millet-bowl',      'Paneer Tikka Millet Bowl',              'grain-protein-bowls', 165.00, 480, 26, 48, 16, 7, false, 30),
    ('sprouts-peanut-bowl',           'Sprouts & Peanut Bowl',                 'grain-protein-bowls', 155.00, 380, 18, 36, 14, 9, false, 40),
    ('mediterranean-chicken-hummus',  'Mediterranean Chicken & Hummus Bowl',   'grain-protein-bowls', 160.00, 450, 36, 42, 14, 7, true,  50),
    -- Breakfast
    ('protein-oats-honey-pancakes',   'Protein Oats & Honey Pancakes',         'breakfast',           149.00, 410, 28, 46, 10, 5, true,  10),
    -- Wraps
    ('hummus-veg-wrap',               'Hummus & Veg Wrap',                     'wraps',               150.00, 360, 12, 44, 14, 6, false, 10),
    ('grilled-chicken-wrap',          'Grilled Chicken Wrap',                  'wraps',               175.00, 450, 32, 36, 12, 4, true,  20),
    ('egg-white-avocado-wrap',        'Egg White & Avocado Wrap',              'wraps',               160.00, 390, 22, 32, 16, 5, false, 30),
    ('paneer-tikka-wrap',             'Paneer Tikka Wrap',                     'wraps',               170.00, 430, 20, 38, 18, 5, false, 40),
    -- Smoothies & Juices
    ('green-detox',                   'Green Detox',                           'smoothies-juices',    110.00, 170,  4, 34,  2, 4, false, 10),
    ('berry-protein-smoothie',        'Berry Protein Smoothie',                'smoothies-juices',    125.00, 290, 26, 28,  6, 5, true,  20),
    ('peanut-butter-banana-smoothie', 'Peanut Butter Banana Smoothie',         'smoothies-juices',    120.00, 350, 18, 42, 14, 4, false, 30),
    ('cold-pressed-abc-juice',        'Cold-Pressed ABC Juice',                'smoothies-juices',    105.00, 140,  2, 30,  1, 2, false, 40),
    -- Salads & Bowls
    ('mediterranean-chicken-salad',   'Mediterranean Chicken Salad',           'salads-bowls',        155.00, 340, 34, 18, 14, 6, false, 10),
    ('grilled-chicken-caesar-lite',   'Grilled Chicken Caesar (Lite)',         'salads-bowls',        180.00, 390, 36, 16, 14, 5, true,  20),
    ('sprout-feta-salad',             'Sprout & Feta Salad',                   'salads-bowls',        160.00, 320, 16, 28, 14, 7, false, 30),
    -- Snacks & Sides
    ('fresh-mix-cut-fruit-bowl',      'Fresh Mix Cut Fruit Bowl',              'snacks-sides',         85.00, 120,  3, 28, 0.5, 3, false, 10)
)
insert into public.menu_items (slug, name, category_id, price, is_popular, sort_order, is_active)
select d.slug, d.name, c.id, d.price, d.popular, d.sort_order, true
  from data d join public.categories c on c.slug = d.category_slug
on conflict (slug) do update
  set name        = excluded.name,
      category_id = excluded.category_id,
      price       = excluded.price,
      is_popular  = excluded.is_popular,
      sort_order  = excluded.sort_order;

with data(slug, kcal, protein, carbs, fat, fiber) as (
  values
    ('quinoa-paneer-bowl',            460, 32, 45, 15,   8),
    ('grilled-chicken-brown-rice',    520, 38, 45, 12,   6),
    ('paneer-tikka-millet-bowl',      480, 26, 48, 16,   7),
    ('sprouts-peanut-bowl',           380, 18, 36, 14,   9),
    ('mediterranean-chicken-hummus',  450, 36, 42, 14,   7),
    ('protein-oats-honey-pancakes',   410, 28, 46, 10,   5),
    ('hummus-veg-wrap',               360, 12, 44, 14,   6),
    ('grilled-chicken-wrap',          450, 32, 36, 12,   4),
    ('egg-white-avocado-wrap',        390, 22, 32, 16,   5),
    ('paneer-tikka-wrap',             430, 20, 38, 18,   5),
    ('green-detox',                   170,  4, 34,  2,   4),
    ('berry-protein-smoothie',        290, 26, 28,  6,   5),
    ('peanut-butter-banana-smoothie', 350, 18, 42, 14,   4),
    ('cold-pressed-abc-juice',        140,  2, 30,  1,   2),
    ('mediterranean-chicken-salad',   340, 34, 18, 14,   6),
    ('grilled-chicken-caesar-lite',   390, 36, 16, 14,   5),
    ('sprout-feta-salad',             320, 16, 28, 14,   7),
    ('fresh-mix-cut-fruit-bowl',      120,  3, 28,  0.5, 3)
)
insert into public.menu_item_nutrition (menu_item_id, calories, protein_g, carbs_g, fat_g, fiber_g, is_derived)
select mi.id, d.kcal, d.protein, d.carbs, d.fat, d.fiber, false
  from data d join public.menu_items mi on mi.slug = d.slug
on conflict (menu_item_id) do update
  set calories = excluded.calories, protein_g = excluded.protein_g,
      carbs_g  = excluded.carbs_g,  fat_g     = excluded.fat_g,
      fiber_g  = excluded.fiber_g;

-- make everything available at the first outlet
insert into public.outlet_menu_items (outlet_id, menu_item_id, is_available)
select o.id, mi.id, true
  from public.outlets o cross join public.menu_items mi
 where o.code = 'BKL-BLR-01'
on conflict do nothing;

-- ── DIY Bowl Studio modifier groups ─────────────────────────────────────────
insert into public.modifier_groups (slug, name, min_select, max_select, sort_order) values
  ('bowl-base',     'Choose your base',    1, 1, 10),
  ('bowl-protein',  'Choose your protein', 1, 1, 20),
  ('bowl-veggies',  'Pick 4 veggies',      1, 4, 30),
  ('bowl-dressing', 'House dressing',      1, 1, 40)
on conflict (slug) do update set name = excluded.name;

with data(group_slug, slug, name, price_delta, kcal, protein, carbs, fat, sort_order) as (
  values
    ('bowl-base',     'quinoa',        'Quinoa',            20.00, 160,  6, 28,  3, 10),
    ('bowl-base',     'brown-rice',    'Brown Rice',         0.00, 150,  4, 32,  1, 20),
    ('bowl-base',     'millet',        'Millet',            10.00, 145,  5, 30,  1, 30),
    ('bowl-base',     'greens',        'Mixed Greens',       0.00,  25,  2,  4,  0, 40),
    ('bowl-protein',  'chicken',       'Grilled Chicken',   60.00, 165, 31,  0,  4, 10),
    ('bowl-protein',  'salmon',        'Teriyaki Salmon',  120.00, 208, 22,  3, 12, 20),
    ('bowl-protein',  'paneer',        'Paneer',            50.00, 265, 18,  6, 20, 30),
    ('bowl-protein',  'tofu',          'Tofu',              40.00, 144, 15,  3,  9, 40),
    ('bowl-veggies',  'broccoli',      'Broccoli',           0.00,  34,  3,  7,  0, 10),
    ('bowl-veggies',  'bell-pepper',   'Bell Pepper',        0.00,  26,  1,  6,  0, 20),
    ('bowl-veggies',  'cherry-tomato', 'Cherry Tomato',      0.00,  18,  1,  4,  0, 30),
    ('bowl-veggies',  'cucumber',      'Cucumber',           0.00,  16,  1,  4,  0, 40),
    ('bowl-veggies',  'red-onion',     'Red Onion',          0.00,  40,  1,  9,  0, 50),
    ('bowl-veggies',  'sweet-corn',    'Sweet Corn',        10.00,  86,  3, 19,  1, 60),
    ('bowl-dressing', 'lemon-herb',    'Lemon Herb',         0.00,  45,  0,  2,  4, 10),
    ('bowl-dressing', 'tahini',        'Tahini',            15.00,  89,  3,  3,  8, 20),
    ('bowl-dressing', 'peri-peri',     'Peri Peri',         10.00,  60,  1,  4,  5, 30),
    ('bowl-dressing', 'curd-mint',     'Curd & Mint',        0.00,  35,  2,  3,  2, 40)
)
insert into public.modifiers (modifier_group_id, slug, name, price_delta, calories, protein_g, carbs_g, fat_g, sort_order)
select g.id, d.slug, d.name, d.price_delta, d.kcal, d.protein, d.carbs, d.fat, d.sort_order
  from data d join public.modifier_groups g on g.slug = d.group_slug
on conflict (modifier_group_id, slug) do update
  set name = excluded.name, price_delta = excluded.price_delta;
