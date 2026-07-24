-- Migration: add generation_mode column to listings
-- Applied manually via Turso CLI (see README.md in this folder).
-- Safe to run twice: uses IF NOT EXISTS.

-- Stores which mode ("creative" | "professional" | "seo" | "tecnica") was
-- used to generate this listing. Null for rows created before this column
-- existed — code falls back to content-sniffing (hasSections) for those.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS generation_mode TEXT;
