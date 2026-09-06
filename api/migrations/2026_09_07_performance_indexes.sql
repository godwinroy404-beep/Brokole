-- ============================================================================
-- Performance indexes migration
-- ============================================================================

ALTER TABLE orders ADD INDEX ord_biz_date_idx (business_date, status);
ALTER TABLE order_lines ADD INDEX ol_order_name_idx (order_id, name_snapshot(64));
ALTER TABLE addresses ADD INDEX addr_user_created_idx (user_id, deleted_at, created_at);
