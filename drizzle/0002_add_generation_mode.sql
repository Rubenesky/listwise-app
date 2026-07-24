-- Migration: add generation_mode column to listings
-- Applied manually via Turso CLI (see README.md in this folder).
-- NOT safe to run twice: SQLite/libSQL's ALTER TABLE ADD COLUMN does not
-- support IF NOT EXISTS (unlike CREATE TABLE/CREATE INDEX). Check first with
-- `turso db shell <db> "PRAGMA table_info(listings);"` before re-running.

-- Stores which mode ("creative" | "professional" | "seo" | "tecnica") was
-- used to generate this listing. Null for rows created before this column
-- existed — code falls back to content-sniffing (hasSections) for those.
ALTER TABLE listings ADD COLUMN generation_mode TEXT;
