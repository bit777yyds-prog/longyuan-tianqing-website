-- ============================================================
-- Migration: Phase 3 task status constraints
-- Scope:
--   - Add a database-level status boundary for task publishing.
--
-- Notes:
--   - Public task visibility depends on draft vs non-draft status.
--   - The app already normalizes writes; this CHECK is a defense-in-depth
--     guard for future write paths.
-- ============================================================

BEGIN;

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_status_check,
    ADD CONSTRAINT tasks_status_check CHECK (
        status IN (
            'draft',
            'open',
            'assigned',
            'in_progress',
            'under_review',
            'rework',
            'accepted',
            'closed'
        )
    );

COMMIT;
