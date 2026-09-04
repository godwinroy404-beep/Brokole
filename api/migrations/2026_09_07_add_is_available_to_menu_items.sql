-- ============================================================================
-- Brokole — Add is_available column to menu_items
-- ============================================================================

ALTER TABLE menu_items ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active;
