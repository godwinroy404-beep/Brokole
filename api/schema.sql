-- ============================================================================
-- BROKOLE ERP — MySQL schema
--
-- Paste this whole file into phpMyAdmin (Hostinger: hPanel -> Databases ->
-- phpMyAdmin -> your database -> SQL tab) and press Go.
--
-- Safe to run more than once.
--
-- IMPORTANT DIFFERENCE FROM THE POSTGRES VERSION:
-- MySQL has no Row Level Security. In the Postgres build the database itself
-- refused to return another customer's order. Here that is impossible, so
-- EVERY access rule is enforced in the PHP API instead. The database will
-- happily hand over any row to anyone holding the connection credentials —
-- which is exactly why those credentials must never reach the browser, and why
-- no query may be built from user input without a prepared statement.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+05:30';

-- ── people ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outlets (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  code          VARCHAR(32)  NOT NULL UNIQUE,
  name          VARCHAR(160) NOT NULL,
  address       TEXT,
  city          VARCHAR(80),
  pincode       VARCHAR(12),
  timezone      VARCHAR(64)  NOT NULL DEFAULT 'Asia/Kolkata',
  day_start     TIME         NOT NULL DEFAULT '06:00:00',
  gstin         VARCHAR(20),
  fssai_license VARCHAR(32),
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Auth and profile in one table. `role` is the security boundary: it is set
-- only by an owner through the API, never by anything the client sends.
CREATE TABLE IF NOT EXISTS users (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  email             VARCHAR(190) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  full_name         VARCHAR(160),
  phone             VARCHAR(32),
  avatar_url        TEXT,
  role              ENUM('customer','kitchen_staff','delivery_rider','dietitian',
                         'inventory_manager','accountant','store_manager','owner')
                    NOT NULL DEFAULT 'customer',
  default_outlet_id CHAR(36) NULL,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME NULL,
  KEY users_role_idx (role),
  CONSTRAINT users_outlet_fk FOREIGN KEY (default_outlet_id) REFERENCES outlets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_outlets (
  user_id    CHAR(36) NOT NULL,
  outlet_id  CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, outlet_id),
  CONSTRAINT so_user_fk   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT so_outlet_fk FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── permissions (data, so a new role is a row not a code change) ────────────
CREATE TABLE IF NOT EXISTS permissions (
  `key`       VARCHAR(64)  NOT NULL PRIMARY KEY,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  role           ENUM('customer','kitchen_staff','delivery_rider','dietitian',
                      'inventory_manager','accountant','store_manager','owner') NOT NULL,
  permission_key VARCHAR(64) NOT NULL,
  PRIMARY KEY (role, permission_key),
  CONSTRAINT rp_perm_fk FOREIGN KEY (permission_key) REFERENCES permissions(`key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── audit trail ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id    CHAR(36) NULL,
  actor_role  VARCHAR(32) NULL,
  table_name  VARCHAR(64) NOT NULL,
  record_id   VARCHAR(64) NULL,
  action      VARCHAR(16) NOT NULL,
  before_json JSON NULL,
  after_json  JSON NULL,
  KEY audit_table_record_idx (table_name, record_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── login throttling (no RLS means brute force is a real concern) ───────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(190) NOT NULL,
  ip          VARCHAR(45)  NOT NULL,
  succeeded   TINYINT(1)   NOT NULL DEFAULT 0,
  attempted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY la_email_time_idx (email, attempted_at),
  KEY la_ip_time_idx (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── catalog ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  slug        VARCHAR(96)  NOT NULL UNIQUE,
  name        VARCHAR(160) NOT NULL,
  description TEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_items (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  category_id CHAR(36) NULL,
  slug        VARCHAR(96)   NOT NULL UNIQUE,
  name        VARCHAR(190)  NOT NULL,
  description TEXT,
  price       DECIMAL(12,2) NOT NULL,
  image_url   TEXT,
  prep_time   VARCHAR(48),
  tags        JSON NULL,                 -- MySQL has no array type
  is_popular  TINYINT(1)    NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  CHAR(36) NULL,
  deleted_at  DATETIME NULL,
  KEY mi_category_idx (category_id),
  KEY mi_active_idx (is_active, deleted_at),
  CONSTRAINT mi_price_chk CHECK (price >= 0),
  CONSTRAINT mi_category_fk FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_item_nutrition (
  menu_item_id CHAR(36)     NOT NULL PRIMARY KEY,
  calories     DECIMAL(8,2) NOT NULL DEFAULT 0,
  protein_g    DECIMAL(8,2) NOT NULL DEFAULT 0,
  carbs_g      DECIMAL(8,2) NOT NULL DEFAULT 0,
  fat_g        DECIMAL(8,2) NOT NULL DEFAULT 0,
  fiber_g      DECIMAL(8,2) NOT NULL DEFAULT 0,
  is_derived   TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT min_item_fk FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outlet_menu_items (
  outlet_id      CHAR(36) NOT NULL,
  menu_item_id   CHAR(36) NOT NULL,
  is_available   TINYINT(1) NOT NULL DEFAULT 1,
  price_override DECIMAL(12,2) NULL,
  PRIMARY KEY (outlet_id, menu_item_id),
  CONSTRAINT omi_outlet_fk FOREIGN KEY (outlet_id)    REFERENCES outlets(id)    ON DELETE CASCADE,
  CONSTRAINT omi_item_fk   FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS modifier_groups (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  slug       VARCHAR(96)  NOT NULL UNIQUE,
  name       VARCHAR(160) NOT NULL,
  min_select INT          NOT NULL DEFAULT 0,
  max_select INT          NOT NULL DEFAULT 1,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS modifiers (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  modifier_group_id CHAR(36)      NOT NULL,
  slug              VARCHAR(96)   NOT NULL,
  name              VARCHAR(160)  NOT NULL,
  price_delta       DECIMAL(12,2) NOT NULL DEFAULT 0,
  calories          DECIMAL(8,2)  NOT NULL DEFAULT 0,
  protein_g         DECIMAL(8,2)  NOT NULL DEFAULT 0,
  carbs_g           DECIMAL(8,2)  NOT NULL DEFAULT 0,
  fat_g             DECIMAL(8,2)  NOT NULL DEFAULT 0,
  sort_order        INT           NOT NULL DEFAULT 0,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY mod_group_slug_uk (modifier_group_id, slug),
  CONSTRAINT mod_group_fk FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  label      VARCHAR(64),
  line1      VARCHAR(255) NOT NULL,
  line2      VARCHAR(255),
  landmark   VARCHAR(255),
  city       VARCHAR(80)  NOT NULL,
  pincode    VARCHAR(12)  NOT NULL,
  is_default TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY addr_user_idx (user_id),
  CONSTRAINT addr_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  order_no       VARCHAR(32)  NOT NULL UNIQUE,
  outlet_id      CHAR(36)     NOT NULL,
  customer_id    CHAR(36)     NOT NULL,
  address_id     CHAR(36) NULL,
  channel        ENUM('web','app','phone','walk_in','subscription') NOT NULL DEFAULT 'web',
  status         ENUM('draft','placed','paid','accepted','in_kitchen','packed',
                      'out_for_delivery','delivered','cancelled','refunded')
                 NOT NULL DEFAULT 'draft',
  business_date  DATE         NOT NULL,
  scheduled_for  DATETIME NULL,
  notes          TEXT,
  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_fee   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_calories DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_protein  DECIMAL(10,2) NOT NULL DEFAULT 0,
  placed_at      DATETIME NULL,
  delivered_at   DATETIME NULL,
  cancelled_at   DATETIME NULL,
  cancel_reason  TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     DATETIME NULL,
  KEY ord_outlet_date_idx (outlet_id, business_date),
  KEY ord_customer_idx (customer_id, created_at),
  KEY ord_status_idx (status),
  KEY ord_updated_idx (updated_at),          -- polling for the live board
  CONSTRAINT ord_outlet_fk   FOREIGN KEY (outlet_id)   REFERENCES outlets(id),
  CONSTRAINT ord_customer_fk FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT ord_address_fk  FOREIGN KEY (address_id)  REFERENCES addresses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_no_seq (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_lines (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  order_id          CHAR(36)      NOT NULL,
  menu_item_id      CHAR(36) NULL,
  name_snapshot     VARCHAR(190)  NOT NULL,
  unit_price        DECIMAL(12,2) NOT NULL,
  quantity          INT           NOT NULL,
  line_total        DECIMAL(12,2) NOT NULL,
  calories_snapshot DECIMAL(8,2)  NOT NULL DEFAULT 0,
  protein_snapshot  DECIMAL(8,2)  NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ol_order_idx (order_id),
  CONSTRAINT ol_qty_chk CHECK (quantity > 0),
  CONSTRAINT ol_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT ol_item_fk  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_status_history (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  order_id    CHAR(36) NOT NULL,
  from_status VARCHAR(24) NULL,
  to_status   VARCHAR(24) NOT NULL,
  changed_by  CHAR(36) NULL,
  note        TEXT,
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY osh_order_idx (order_id, changed_at),
  CONSTRAINT osh_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS subscription_skips (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  order_id   CHAR(36)     NULL,               -- the subscription order, when there is one
  skip_date  DATE         NOT NULL,
  reason     VARCHAR(255) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One row per customer per day: skipping twice is not a thing.
  UNIQUE KEY ss_user_date_uk (user_id, skip_date),
  -- The kitchen asks "who is skipping tomorrow?" — that query needs this.
  KEY ss_date_idx (skip_date),

  CONSTRAINT ss_user_fk  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT ss_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
