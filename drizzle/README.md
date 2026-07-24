# Drizzle Migrations

## Why this folder has no auto-generated files

Drizzle-kit `generate` creates migration files by diffing the current schema against a known baseline. Because the database was bootstrapped manually (before this migration system was put in place), there is no snapshot for Drizzle to diff against. Running `drizzle-kit generate` would produce SQL that recreates the **entire schema** — which is wrong for an already-running database.

## How to apply migrations

Migrations in this folder are plain SQL files intended to be run **once**, manually, against the production Turso database:

```bash
# Via the Turso CLI
turso db shell <DATABASE_NAME> ".read drizzle/0001_indexes_and_cleanup.sql"
```

Most files are idempotent (`CREATE TABLE`/`CREATE INDEX` with `IF NOT EXISTS` / `IF EXISTS` guards) so they're safe to re-run. **Exception:** `ALTER TABLE ... ADD COLUMN` does NOT support `IF NOT EXISTS` in SQLite/libSQL — check `PRAGMA table_info(<table>);` first before re-running a column-adding migration, or it will error.

## Migration log

| File | Description | Status |
|------|-------------|--------|
| `0001_indexes_and_cleanup.sql` | Adds composite indexes on `agent_analytics` and `competitor_analyses`; drops dead `agent_credits` table | Pending |
| `0002_add_generation_mode.sql` | Adds `generation_mode` column to `listings` | Applied to `listwise-db` on 2026-07-24 |
