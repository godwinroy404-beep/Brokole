-- ============================================================================
-- Brokole - inventory
--
-- Run once. Safe to run more than once.
--
-- Stock is an APPEND-ONLY LEDGER, not a mutable quantity column. On-hand is
-- derived by summing movements. The moment two things update a `quantity`
-- field at once you lose the ability to explain your own stock - and in a food
-- business that ledger is also the traceability trail.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredients (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  sku           VARCHAR(48)  NOT NULL UNIQUE,
  name          VARCHAR(190) NOT NULL,
  category      VARCHAR(80)  NOT NULL DEFAULT 'Uncategorised',
  unit          VARCHAR(12)  NOT NULL DEFAULT 'kg',
  min_threshold DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  supplier      VARCHAR(190) NULL,
  outlet_id     CHAR(36)     NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  KEY ing_category_idx (category),
  CONSTRAINT ing_outlet_fk FOREIGN KEY (outlet_id) REFERENCES outlets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stock_movements (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  ingredient_id CHAR(36)      NOT NULL,
  -- receipt/adjustment are positive, issue/wastage negative; the sign is
  -- enforced in the API so the ledger can simply be SUM()ed.
  kind          ENUM('receipt','issue','wastage','adjustment') NOT NULL,
  quantity      DECIMAL(12,3) NOT NULL,
  unit_cost     DECIMAL(12,2) NULL,
  reason        VARCHAR(255)  NULL,
  reference     VARCHAR(64)   NULL,
  actor_id      CHAR(36)      NULL,
  occurred_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY sm_ingredient_idx (ingredient_id, occurred_at),
  KEY sm_kind_idx (kind, occurred_at),
  CONSTRAINT sm_ing_fk   FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  CONSTRAINT sm_actor_fk FOREIGN KEY (actor_id)      REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- On-hand is derived, never stored.
CREATE OR REPLACE VIEW stock_on_hand AS
SELECT
  i.id AS ingredient_id,
  COALESCE(SUM(m.quantity), 0) AS on_hand,
  MAX(CASE WHEN m.kind = 'receipt' THEN m.occurred_at END) AS last_restocked,
  COALESCE(SUM(CASE WHEN m.kind = 'wastage' THEN -m.quantity END), 0) AS wasted_total
FROM ingredients i
LEFT JOIN stock_movements m ON m.ingredient_id = i.id
GROUP BY i.id;

-- A starting shelf so the screen isn't empty.
INSERT INTO ingredients (id, sku, name, category, unit, min_threshold, cost_per_unit, supplier)
VALUES
 (UUID(),'RAW-PNR-01','Organic Fresh Paneer','Dairy & Alternatives','kg',10,280,'Heritage Dairy'),
 (UUID(),'RAW-CHK-01','Boneless Chicken Breast','Proteins','kg',12,320,'FarmFresh Supplies'),
 (UUID(),'RAW-QNA-01','Quinoa','Grains','kg',8,240,'Organic Traders'),
 (UUID(),'RAW-RIC-01','Brown Rice','Grains','kg',15,95,'Organic Traders'),
 (UUID(),'RAW-TOF-01','Tofu','Proteins','kg',6,220,'SoyLife Foods'),
 (UUID(),'RAW-BRO-01','Broccoli','Vegetables','kg',5,120,'GreenLeaf Farms'),
 (UUID(),'RAW-BEL-01','Bell Peppers','Vegetables','kg',5,140,'GreenLeaf Farms'),
 (UUID(),'RAW-AVO-01','Avocado','Vegetables','pcs',20,90,'GreenLeaf Farms'),
 (UUID(),'RAW-OAT-01','Rolled Oats','Grains','kg',10,110,'Organic Traders'),
 (UUID(),'RAW-WHY-01','Whey Protein Isolate','Supplements','kg',4,2400,'NutriSource'),
 (UUID(),'RAW-BER-01','Mixed Berries (Frozen)','Fruits','kg',6,380,'ColdHarvest'),
 (UUID(),'RAW-TAH-01','Tahini','Condiments','kg',3,520,'Levant Foods')
ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category);

-- Opening stock, recorded as receipts so the ledger explains where it came from.
INSERT INTO stock_movements (id, ingredient_id, kind, quantity, unit_cost, reason)
SELECT UUID(), i.id, 'receipt', ROUND(i.min_threshold * 1.6, 3), i.cost_per_unit, 'Opening balance'
  FROM ingredients i
 WHERE NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.ingredient_id = i.id);

SELECT 'ingredients' AS t, COUNT(*) AS n FROM ingredients
UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements;
