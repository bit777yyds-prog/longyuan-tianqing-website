-- ============================================================
-- Migration: Phase 2 auth foundation
-- Scope:
--   - app_users binds login identities to actors
--   - auth_accounts stores Better Auth credential/provider records
--   - auth_sessions stores auditable session token hashes
--   - auth_secondary_storage stores encrypted Better Auth session state
--   - invitations stores one-time invite token hashes
--
-- Notes:
--   - Raw invite/session tokens are never stored.
--   - Better Auth remains the intended auth library; these tables preserve
--     project governance requirements and can be used by an adapter.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL UNIQUE REFERENCES actors(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    image TEXT,
    role TEXT NOT NULL CHECK (role IN ('participant','project_owner','reviewer','admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','disabled')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_app_users_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_users_updated_at_trigger ON app_users;
CREATE TRIGGER app_users_updated_at_trigger
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_app_users_updated_at();

CREATE TABLE IF NOT EXISTS auth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    password TEXT,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts(user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id),
    actor_id UUID NOT NULL REFERENCES actors(id),
    session_token_sha256 TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_actor ON auth_sessions(actor_id, expires_at);

-- Better Auth receives opaque keys and JSON values. Keys are SHA-256 digests;
-- values are AES-GCM ciphertext produced by the web application.
CREATE TABLE IF NOT EXISTS auth_secondary_storage (
    key_sha256 TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_secondary_storage_expiry
    ON auth_secondary_storage(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_sha256 TEXT NOT NULL UNIQUE,
    invited_email TEXT NOT NULL,
    invited_role TEXT NOT NULL CHECK (invited_role IN ('participant','project_owner','reviewer','admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','revoked','expired')),
    created_by_actor_id UUID NOT NULL REFERENCES actors(id),
    created_for_actor_id UUID REFERENCES actors(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    used_by_actor_id UUID REFERENCES actors(id),
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (expires_at > created_at),
    CHECK (expires_at <= created_at + interval '30 days'),
    CHECK (
        (status = 'used' AND used_at IS NOT NULL AND used_by_actor_id IS NOT NULL)
        OR (status <> 'used' AND used_at IS NULL AND used_by_actor_id IS NULL)
    ),
    CHECK (
        (status = 'revoked' AND revoked_at IS NOT NULL)
        OR (status <> 'revoked' AND revoked_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON invitations(invited_email, status);
CREATE INDEX IF NOT EXISTS idx_invitations_expiry ON invitations(status, expires_at);

GRANT SELECT, INSERT, UPDATE ON TABLE app_users TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_accounts TO app_rw;
GRANT SELECT, INSERT, UPDATE ON TABLE auth_sessions TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_secondary_storage TO app_rw;
GRANT SELECT, INSERT, UPDATE ON TABLE invitations TO app_rw;

-- Keep approval_event_writer away from auth secrets and invite hashes.
REVOKE ALL ON TABLE app_users, auth_accounts, auth_sessions, auth_secondary_storage, invitations
    FROM worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;

COMMIT;
