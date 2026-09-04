-- ============================================================================
-- Brokole — subscription skips
--
-- Run once in phpMyAdmin (SQL tab). Safe to run more than once.
--
-- Replaces the previous approach, which stored skipped days inside
-- orders.notes as a "[SKIPPED_DAYS: 3,5]" text tag. That was unqueryable, was
-- wiped whenever anything else wrote to notes, polluted the note the kitchen
-- reads, and used a day-of-month number that is ambiguous across months.
--
-- A skip is now a row with a real date, unique per customer per day.
-- ============================================================================

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

-- Strip any leftover [SKIPPED_DAYS: ...] tag so notes go back to being notes.
-- (Old tags carried a day number with no month, so there is nothing reliable to
-- migrate from them — customers re-pick their skip days in the calendar.)
UPDATE orders
   SET notes = NULLIF(TRIM(REGEXP_REPLACE(notes, '\\[SKIPPED_DAYS:[0-9, ]*\\]', '')), '')
 WHERE notes LIKE '%[SKIPPED_DAYS:%';

SELECT 'subscription_skips' AS table_name, COUNT(*) AS rows_now FROM subscription_skips;
