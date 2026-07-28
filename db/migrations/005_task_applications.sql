-- ============================================================
-- Migration: Task applications
-- Scope:
--   - Store participant applications for open tasks.
--   - Keep applications separate from task_assignments; an application is
--     intent, while an assignment is accepted work.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS task_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    applicant_user_id UUID NOT NULL REFERENCES app_users(id),
    applicant_actor_id UUID NOT NULL REFERENCES actors(id),
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted','withdrawn','accepted','rejected')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, applicant_actor_id),
    CHECK (length(trim(message)) BETWEEN 10 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_task_applications_task_status
    ON task_applications(task_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_applications_applicant
    ON task_applications(applicant_actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_task_applications_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_applications_updated_at_trigger ON task_applications;
CREATE TRIGGER task_applications_updated_at_trigger
BEFORE UPDATE ON task_applications
FOR EACH ROW EXECUTE FUNCTION set_task_applications_updated_at();

GRANT SELECT, INSERT, UPDATE ON TABLE task_applications TO app_rw;

REVOKE ALL ON TABLE task_applications
    FROM worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;

COMMIT;
