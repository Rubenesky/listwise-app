-- drizzle/0003_add_enriched_sources.sql
-- Migration: create enriched_sources table
-- Applied manually via Turso CLI (see README.md in this folder).
-- Safe to run twice: CREATE TABLE/INDEX IF NOT EXISTS is valid SQLite syntax
-- (unlike ALTER TABLE ADD COLUMN, which is NOT — see 0002's note).

CREATE TABLE IF NOT EXISTS enriched_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  listing_id TEXT,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  extracted_text TEXT,
  error_message TEXT,
  cache_expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_enriched_sources_user_id ON enriched_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_enriched_sources_listing_id ON enriched_sources(listing_id);
