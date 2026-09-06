-- ============================================================================
-- BROKOLE ERP - MySQL seed
-- Run AFTER schema.sql, in the same phpMyAdmin SQL tab. Safe to re-run.
-- ============================================================================
SET NAMES utf8mb4;

-- ── permissions ─────────────────────────────────────────────────────────────
INSERT INTO permissions (`key`, description) VALUES
 ('menu.read','View the full menu including inactive items'),
 ('menu.write','Create, edit and retire menu items'),
 ('orders.read.all','View all orders, not just your own'),
 ('orders.update.status','Advance or cancel an order'),
 ('inventory.read','View stock levels and movements'),
 ('inventory.write','Record stock movements, wastage and adjustments'),
 ('vendors.read','View vendors and purchase orders'),
 ('vendors.write','Raise purchase orders and receive goods'),
 ('customers.read','View customer profiles and contact details'),
 ('finance.read','View revenue, COGS and tax reports'),
 ('staff.manage','Invite staff and change roles'),
 ('audit.read','Read the audit trail')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT IGNORE INTO role_permissions (role, permission_key) VALUES
 ('kitchen_staff','menu.read'),('kitchen_staff','orders.read.all'),
 ('kitchen_staff','orders.update.status'),('kitchen_staff','inventory.read'),
 ('delivery_rider','orders.read.all'),('delivery_rider','orders.update.status'),
 ('dietitian','menu.read'),('dietitian','customers.read'),
 ('inventory_manager','menu.read'),('inventory_manager','inventory.read'),
 ('inventory_manager','inventory.write'),('inventory_manager','vendors.read'),
 ('inventory_manager','vendors.write'),
 ('accountant','orders.read.all'),('accountant','finance.read'),
 ('accountant','vendors.read'),('accountant','audit.read'),
 ('store_manager','menu.read'),('store_manager','menu.write'),
 ('store_manager','orders.read.all'),('store_manager','orders.update.status'),
 ('store_manager','inventory.read'),('store_manager','inventory.write'),
 ('store_manager','vendors.read'),('store_manager','vendors.write'),
 ('store_manager','customers.read'),('store_manager','finance.read'),
 ('owner','menu.read'),('owner','menu.write'),('owner','orders.read.all'),
 ('owner','orders.update.status'),('owner','inventory.read'),('owner','inventory.write'),
 ('owner','vendors.read'),('owner','vendors.write'),('owner','customers.read'),
 ('owner','finance.read'),('owner','staff.manage'),('owner','audit.read');

-- ── first outlet ────────────────────────────────────────────────────────────
INSERT INTO outlets (id, code, name, city, timezone) VALUES
 (UUID(),'BKL-BLR-01','Brokole Central Kitchen','Bengaluru','Asia/Kolkata')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ── categories ──────────────────────────────────────────────────────────────
INSERT INTO categories (id, slug, name, sort_order) VALUES
 (UUID(),'grain-protein-bowls','Grain & Protein Bowls',10),
 (UUID(),'wraps','Wraps',20),
 (UUID(),'salads-bowls','Salads & Bowls',30),
 (UUID(),'smoothies-juices','Smoothies & Juices',40),
 (UUID(),'breakfast','Breakfast',50),
 (UUID(),'snacks-sides','Snacks & Sides',60)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- ── the 18 live meals ───────────────────────────────────────────────────────
CREATE TEMPORARY TABLE seed_items (
  slug VARCHAR(96) PRIMARY KEY, name VARCHAR(190), cat_slug VARCHAR(96),
  price DECIMAL(12,2), kcal DECIMAL(8,2), protein DECIMAL(8,2), carbs DECIMAL(8,2),
  fat DECIMAL(8,2), fiber DECIMAL(8,2), popular TINYINT, sort_order INT, image_url TEXT
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO seed_items VALUES
 ('quinoa-paneer-bowl','Quinoa Paneer Bowl','grain-protein-bowls',160.00,460,32,45,15,8,1,10,'/images/quinoa_paneer_bowl.png'),
 ('grilled-chicken-brown-rice','Grilled Chicken & Brown Rice','grain-protein-bowls',180.00,520,38,45,12,6,1,20,'/images/grilled_chicken_brown_rice.png'),
 ('paneer-tikka-millet-bowl','Paneer Tikka Millet Bowl','grain-protein-bowls',165.00,480,26,48,16,7,0,30,'/images/paneer_tikka_millet.png'),
 ('sprouts-peanut-bowl','Sprouts & Peanut Bowl','grain-protein-bowls',155.00,380,18,36,14,9,0,40,'/images/sprouts_peanut_bowl.png'),
 ('mediterranean-chicken-hummus','Mediterranean Chicken & Hummus Bowl','grain-protein-bowls',160.00,450,36,42,14,7,1,50,'/images/hummus_bowl.png'),
 ('protein-oats-honey-pancakes','Protein Oats & Honey Pancakes','breakfast',149.00,410,28,46,10,5,1,10,'/images/protein_pancakes.png'),
 ('hummus-veg-wrap','Hummus & Veg Wrap','wraps',150.00,360,12,44,14,6,0,10,'/images/hummus_veg_wrap.png'),
 ('grilled-chicken-wrap','Grilled Chicken Wrap','wraps',175.00,450,32,36,12,4,1,20,'/images/grilled_chicken_wrap.png'),
 ('egg-white-avocado-wrap','Egg White & Avocado Wrap','wraps',160.00,390,22,32,16,5,0,30,'/images/egg_white_avocado_wrap.png'),
 ('paneer-tikka-wrap','Paneer Tikka Wrap','wraps',170.00,430,20,38,18,5,0,40,'/images/paneer_tikka_wrap.png'),
 ('green-detox','Green Detox','smoothies-juices',110.00,170,4,34,2,4,0,10,'/images/green_detox_smoothie.png'),
 ('berry-protein-smoothie','Berry Protein Smoothie','smoothies-juices',125.00,290,26,28,6,5,1,20,'/images/berry_protein_smoothie.png'),
 ('peanut-butter-banana-smoothie','Peanut Butter Banana Smoothie','smoothies-juices',120.00,350,18,42,14,4,0,30,'/images/peanut_butter_banana.png'),
 ('cold-pressed-abc-juice','Cold-Pressed ABC Juice','smoothies-juices',105.00,140,2,30,1,2,0,40,'/images/cold_pressed_abc_juice.png'),
 ('mediterranean-chicken-salad','Mediterranean Chicken Salad','salads-bowls',155.00,340,34,18,14,6,0,10,'/images/mediterranean_chicken.png'),
 ('grilled-chicken-caesar-lite','Grilled Chicken Caesar (Lite)','salads-bowls',180.00,390,36,16,14,5,1,20,'/images/grilled_chicken_caesar.png'),
 ('sprout-feta-salad','Sprout & Feta Salad','salads-bowls',160.00,320,16,28,14,7,0,30,'/images/sprouts_peanut_bowl.png'),
 ('fresh-mix-cut-fruit-bowl','Fresh Mix Cut Fruit Bowl','snacks-sides',85.00,120,3,28,0.5,3,0,10,'/images/mix_fruit_bowl.png');

INSERT INTO menu_items (id, slug, name, category_id, price, image_url, is_popular, sort_order, is_active)
SELECT UUID(), s.slug, s.name, c.id, s.price, s.image_url, s.popular, s.sort_order, 1
  FROM seed_items s JOIN categories c ON c.slug = s.cat_slug
ON DUPLICATE KEY UPDATE
  name = VALUES(name), category_id = VALUES(category_id), price = VALUES(price),
  image_url = VALUES(image_url), is_popular = VALUES(is_popular), sort_order = VALUES(sort_order);

INSERT INTO menu_item_nutrition (menu_item_id, calories, protein_g, carbs_g, fat_g, fiber_g)
SELECT mi.id, s.kcal, s.protein, s.carbs, s.fat, s.fiber
  FROM seed_items s JOIN menu_items mi ON mi.slug = s.slug
ON DUPLICATE KEY UPDATE
  calories = VALUES(calories), protein_g = VALUES(protein_g), carbs_g = VALUES(carbs_g),
  fat_g = VALUES(fat_g), fiber_g = VALUES(fiber_g);

INSERT IGNORE INTO outlet_menu_items (outlet_id, menu_item_id, is_available)
SELECT o.id, mi.id, 1 FROM outlets o CROSS JOIN menu_items mi WHERE o.code = 'BKL-BLR-01';

DROP TEMPORARY TABLE seed_items;

-- ── DIY Bowl Studio ─────────────────────────────────────────────────────────
INSERT INTO modifier_groups (id, slug, name, min_select, max_select, sort_order) VALUES
 (UUID(),'bowl-base','Choose your base',1,1,10),
 (UUID(),'bowl-protein','Choose your protein',1,1,20),
 (UUID(),'bowl-veggies','Pick 4 veggies',1,4,30),
 (UUID(),'bowl-dressing','House dressing',1,1,40)
ON DUPLICATE KEY UPDATE name = VALUES(name);

CREATE TEMPORARY TABLE seed_mods (
  grp VARCHAR(96), slug VARCHAR(96), name VARCHAR(160), price_delta DECIMAL(12,2),
  kcal DECIMAL(8,2), protein DECIMAL(8,2), carbs DECIMAL(8,2), fat DECIMAL(8,2), sort_order INT
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO seed_mods VALUES
 ('bowl-base','quinoa','Quinoa',20.00,160,6,28,3,10),
 ('bowl-base','brown-rice','Brown Rice',0.00,150,4,32,1,20),
 ('bowl-base','millet','Millet',10.00,145,5,30,1,30),
 ('bowl-base','greens','Mixed Greens',0.00,25,2,4,0,40),
 ('bowl-protein','chicken','Grilled Chicken',60.00,165,31,0,4,10),
 ('bowl-protein','salmon','Teriyaki Salmon',120.00,208,22,3,12,20),
 ('bowl-protein','paneer','Paneer',50.00,265,18,6,20,30),
 ('bowl-protein','tofu','Tofu',40.00,144,15,3,9,40),
 ('bowl-veggies','broccoli','Broccoli',0.00,34,3,7,0,10),
 ('bowl-veggies','bell-pepper','Bell Pepper',0.00,26,1,6,0,20),
 ('bowl-veggies','cherry-tomato','Cherry Tomato',0.00,18,1,4,0,30),
 ('bowl-veggies','cucumber','Cucumber',0.00,16,1,4,0,40),
 ('bowl-veggies','red-onion','Red Onion',0.00,40,1,9,0,50),
 ('bowl-veggies','sweet-corn','Sweet Corn',10.00,86,3,19,1,60),
 ('bowl-dressing','lemon-herb','Lemon Herb',0.00,45,0,2,4,10),
 ('bowl-dressing','tahini','Tahini',15.00,89,3,3,8,20),
 ('bowl-dressing','peri-peri','Peri Peri',10.00,60,1,4,5,30),
 ('bowl-dressing','curd-mint','Curd & Mint',0.00,35,2,3,2,40);

INSERT INTO modifiers (id, modifier_group_id, slug, name, price_delta, calories, protein_g, carbs_g, fat_g, sort_order)
SELECT UUID(), g.id, s.slug, s.name, s.price_delta, s.kcal, s.protein, s.carbs, s.fat, s.sort_order
  FROM seed_mods s JOIN modifier_groups g ON g.slug = s.grp
ON DUPLICATE KEY UPDATE name = VALUES(name), price_delta = VALUES(price_delta);

DROP TEMPORARY TABLE seed_mods;

-- ── verification ────────────────────────────────────────────────────────────
SELECT 'outlets' AS item, COUNT(*) AS actual, 1 AS expected FROM outlets
UNION ALL SELECT 'categories', COUNT(*), 6  FROM categories
UNION ALL SELECT 'menu_items', COUNT(*), 18 FROM menu_items
UNION ALL SELECT 'nutrition',  COUNT(*), 18 FROM menu_item_nutrition
UNION ALL SELECT 'modifiers',  COUNT(*), 18 FROM modifiers
UNION ALL SELECT 'permissions',COUNT(*), 12 FROM permissions
UNION ALL SELECT 'role_perms', COUNT(*), 39 FROM role_permissions;
