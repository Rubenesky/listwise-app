-- Migration: add cancel_at_period_end to subscriptions
-- Applied manually via Turso CLI (see README.md in this folder).
-- IMPORTANT: ALTER TABLE ADD COLUMN does NOT support IF NOT EXISTS in
-- SQLite/libSQL — check `PRAGMA table_info(subscriptions);` first before
-- re-running this, or it will error if the column already exists.

ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
