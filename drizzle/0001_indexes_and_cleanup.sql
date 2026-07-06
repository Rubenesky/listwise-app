-- Migration: additive indexes + drop dead agent_credits table
-- Applied manually (no drizzle migration history exists — drizzle-kit generate
-- would recreate the entire schema). Run once against the production DB.
-- Safe to run twice: all statements use IF NOT EXISTS / IF EXISTS guards.

-- ── New composite indexes (already defined in ORM schema, adding to DB) ─────

-- Fast lookup: agent analytics per user+listing (used by agentAnalytics join queries)
CREATE INDEX IF NOT EXISTS idx_agent_analytics_user_listing
  ON agent_analytics (user_id, listing_id);

-- Fast lookup: competitor analyses by listing + status (used by polling & cache queries)
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_listing_status
  ON competitor_analyses (listing_id, status);

-- ── Drop dead table ───────────────────────────────────────────────────────────
-- agent_credits was superseded by users.agent_credits + users.agent_plan columns.
-- No code in the application queries this table.

DROP TABLE IF EXISTS agent_credits;
