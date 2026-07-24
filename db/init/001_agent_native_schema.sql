-- 龙渊天青 Agent 原生网站核心 Schema v0.2
-- PostgreSQL 15+
-- 说明：这是MVP骨架，不是最终生产Schema。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('human','agent','organization','system','scheduler')),
    display_name TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_actor_id UUID REFERENCES actors(id),
    status TEXT NOT NULL DEFAULT 'active',
    policy_version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    work_type TEXT NOT NULL,
    series_name TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    version TEXT NOT NULL DEFAULT '0.1',
    copyright_status TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE work_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    work_id UUID REFERENCES works(id),
    object_type TEXT NOT NULL,
    name TEXT NOT NULL,
    current_state TEXT NOT NULL DEFAULT 'created',
    version BIGINT NOT NULL DEFAULT 1,
    owner_actor_id UUID REFERENCES actors(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    work_object_id UUID REFERENCES work_objects(id),
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    prior_state TEXT,
    target_state TEXT,
    publisher_actor_id UUID REFERENCES actors(id),
    owner_actor_id UUID REFERENCES actors(id),
    application_deadline TIMESTAMPTZ,
    delivery_deadline TIMESTAMPTZ,
    acceptance_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    compensation JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_version TEXT NOT NULL DEFAULT '1.0',
    schema_version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    actor_id UUID NOT NULL REFERENCES actors(id),
    assignment_role TEXT NOT NULL DEFAULT 'executor',
    status TEXT NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(task_id, actor_id, assignment_role)
);

CREATE TABLE deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    submitted_by_actor_id UUID NOT NULL REFERENCES actors(id),
    version BIGINT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'submitted',
    description TEXT,
    object_key TEXT,
    content_sha256 TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    deliverable_id UUID NOT NULL REFERENCES deliverables(id),
    reviewer_actor_id UUID NOT NULL REFERENCES actors(id),
    decision TEXT NOT NULL CHECK (decision IN ('pass','rework','reject','manual_review')),
    feedback TEXT,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_version TEXT NOT NULL DEFAULT '1.0',
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES actors(id),
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    idempotency_key TEXT NOT NULL UNIQUE,
    occurred_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    schema_version TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    payload JSONB NOT NULL,
    payload_sha256 TEXT,
    source_ref JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_event_object ON event_ledger(object_type, object_id, recorded_at);
CREATE INDEX idx_event_correlation ON event_ledger(correlation_id, recorded_at);
CREATE INDEX idx_event_type ON event_ledger(event_type, recorded_at);

CREATE OR REPLACE FUNCTION prevent_event_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'event_ledger is append-only; use corrective events';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_ledger_no_update
BEFORE UPDATE OR DELETE ON event_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

CREATE TABLE state_projections (
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    current_state TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    last_event_id UUID NOT NULL REFERENCES event_ledger(id),
    projection JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (object_type, object_id)
);

CREATE TABLE model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    template TEXT NOT NULL,
    output_schema JSONB,
    content_sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(name, version)
);

CREATE TABLE agent_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL UNIQUE REFERENCES actors(id),
    code TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_definition_id UUID NOT NULL REFERENCES agent_definitions(id),
    version TEXT NOT NULL,
    model_config_id UUID NOT NULL REFERENCES model_configs(id),
    prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
    autonomy_level TEXT NOT NULL DEFAULT 'A1' CHECK (autonomy_level IN ('A0','A1','A2','A3')),
    allowed_job_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_candidate_event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    auto_approve_event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    requires_human_review BOOLEAN NOT NULL DEFAULT true,
    post_audit_sample_rate NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    max_cost_per_run NUMERIC(12,4),
    max_daily_cost NUMERIC(12,4),
    validator_version TEXT,
    policy_version TEXT NOT NULL DEFAULT '1.0',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_definition_id, version)
);

CREATE TABLE agent_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    agent_version_id UUID NOT NULL REFERENCES agent_versions(id),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event','schedule','manual')),
    source_event_id UUID REFERENCES event_ledger(id),
    triggered_by_actor_id UUID REFERENCES actors(id),
    correlation_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    input JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead_letter','cancelled')),
    priority INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_jobs_queue
ON agent_jobs(status, available_at, priority DESC, created_at);

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES agent_jobs(id),
    agent_version_id UUID NOT NULL REFERENCES agent_versions(id),
    trace_id UUID NOT NULL,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    prompt_version_id UUID REFERENCES prompt_versions(id),
    input_sha256 TEXT,
    output_sha256 TEXT,
    raw_output JSONB,
    parsed_output JSONB,
    validation_result JSONB,
    input_tokens BIGINT,
    output_tokens BIGINT,
    cost_amount NUMERIC(12,6),
    latency_ms BIGINT,
    status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE TABLE candidate_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposed_event_type TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES actors(id),
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    source_event_id UUID REFERENCES event_ledger(id),
    source_run_id UUID REFERENCES agent_runs(id),
    proposed_payload JSONB NOT NULL,
    confidence NUMERIC(6,5),
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_level TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','superseded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_event_id UUID NOT NULL REFERENCES candidate_events(id),
    decision TEXT NOT NULL CHECK (decision IN ('approve','reject','modify')),
    decided_by_actor_id UUID NOT NULL REFERENCES actors(id),
    decision_reason TEXT,
    modifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_version TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    job_type TEXT NOT NULL,
    agent_version_id UUID NOT NULL REFERENCES agent_versions(id),
    input_template JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES actors(id),
    action TEXT NOT NULL,
    object_type TEXT,
    object_id UUID,
    request_id UUID,
    trace_id UUID,
    before_data JSONB,
    after_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 推荐生产权限（需由部署脚本创建角色并GRANT）：
-- worker_candidate_rw: SELECT业务与事件；INSERT agent_runs/candidate_events；UPDATE agent_jobs；禁止INSERT event_ledger。
-- approval_event_writer: INSERT event_ledger；UPDATE state_projections/candidate_events；INSERT approvals/audit_logs。
-- readonly_analytics: SELECT只读。


-- =========================================================
-- v0.2 安全、出站、重放、影子、语言与合规补强
-- =========================================================

DO $$ BEGIN
    CREATE TYPE egress_class_enum AS ENUM ('public','internal','restricted','forbidden');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE work_objects
    ADD COLUMN IF NOT EXISTS egress_class egress_class_enum NOT NULL DEFAULT 'internal';

ALTER TABLE deliverables
    ADD COLUMN IF NOT EXISTS egress_class egress_class_enum NOT NULL DEFAULT 'internal',
    ADD COLUMN IF NOT EXISTS contains_external_content BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE model_configs
    ADD COLUMN IF NOT EXISTS regulatory_status TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS filing_or_registration_number TEXT,
    ADD COLUMN IF NOT EXISTS regulatory_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS provider_region TEXT,
    ADD COLUMN IF NOT EXISTS data_processing_region TEXT,
    ADD COLUMN IF NOT EXISTS provider_terms_version TEXT,
    ADD COLUMN IF NOT EXISTS data_retention_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE prompt_versions
    ADD COLUMN IF NOT EXISTS output_locale TEXT NOT NULL DEFAULT 'zh-CN',
    ADD COLUMN IF NOT EXISTS validator_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS supersedes_prompt_version_id UUID REFERENCES prompt_versions(id);

ALTER TABLE agent_jobs
    ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'primary'
        CHECK (run_mode IN ('primary','shadow','replay','rerun')),
    ADD COLUMN IF NOT EXISTS comparison_group_id UUID,
    ADD COLUMN IF NOT EXISTS replay_source_run_id UUID REFERENCES agent_runs(id),
    ADD COLUMN IF NOT EXISTS source_trust_level TEXT NOT NULL DEFAULT 'internal'
        CHECK (source_trust_level IN ('trusted_system','internal','external')),
    ADD COLUMN IF NOT EXISTS contains_external_content BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

ALTER TABLE agent_runs
    ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'primary'
        CHECK (run_mode IN ('primary','shadow','replay','rerun')),
    ADD COLUMN IF NOT EXISTS replay_source_run_id UUID REFERENCES agent_runs(id),
    ADD COLUMN IF NOT EXISTS shadow_of_run_id UUID REFERENCES agent_runs(id),
    ADD COLUMN IF NOT EXISTS comparison_group_id UUID,
    ADD COLUMN IF NOT EXISTS output_locale_detected TEXT,
    ADD COLUMN IF NOT EXISTS language_validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS egress_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS replayed_from_stored_output BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE candidate_events
    ADD COLUMN IF NOT EXISTS contains_external_content BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_approval_eligible BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT candidate_external_never_auto_approve
        CHECK (NOT contains_external_content OR auto_approval_eligible = false);

CREATE TABLE IF NOT EXISTS agent_trigger_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    job_type TEXT NOT NULL,
    agent_version_id UUID NOT NULL REFERENCES agent_versions(id),
    enabled BOOLEAN NOT NULL DEFAULT true,
    contains_external_content BOOLEAN NOT NULL DEFAULT false,
    allow_auto_approve BOOLEAN NOT NULL DEFAULT false,
    input_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT external_trigger_never_auto_approve
        CHECK (NOT contains_external_content OR allow_auto_approve = false)
);

CREATE TABLE IF NOT EXISTS egress_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES agent_jobs(id),
    run_id UUID REFERENCES agent_runs(id),
    actor_id UUID REFERENCES actors(id),
    highest_egress_class egress_class_enum NOT NULL,
    model_config_id UUID REFERENCES model_configs(id),
    object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision TEXT NOT NULL CHECK (decision IN ('allowed','blocked','redacted')),
    reason TEXT,
    manifest_sha256 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operational_event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'agent.run.failed',
            'agent.job.dead_lettered',
            'agent.timeout',
            'agent.output_validation_failed',
            'agent.language_validation_failed',
            'agent.egress_blocked',
            'agent.cost_limit_exceeded',
            'agent.provider_unavailable'
        )
    ),
    actor_id UUID NOT NULL REFERENCES actors(id),
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    idempotency_key TEXT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    trace_id UUID,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','applied','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_event_id UUID REFERENCES event_ledger(id),
    applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS configuration_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_type TEXT NOT NULL CHECK (config_type IN ('model_config','prompt_version','agent_version')),
    config_id UUID NOT NULL,
    lifecycle_event TEXT NOT NULL CHECK (lifecycle_event IN ('activated','deprecated','revoked')),
    actor_id UUID NOT NULL REFERENCES actors(id),
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prompt版本内容完全不可热改
DROP TRIGGER IF EXISTS prompt_versions_no_mutation ON prompt_versions;
CREATE TRIGGER prompt_versions_no_mutation
BEFORE UPDATE OR DELETE ON prompt_versions
FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

-- Agent版本只允许修改status，其他语义字段不可热改
CREATE OR REPLACE FUNCTION protect_agent_version_semantics()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'agent_versions are immutable; use lifecycle events';
    END IF;
    IF NEW.agent_definition_id IS DISTINCT FROM OLD.agent_definition_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.model_config_id IS DISTINCT FROM OLD.model_config_id
       OR NEW.prompt_version_id IS DISTINCT FROM OLD.prompt_version_id
       OR NEW.autonomy_level IS DISTINCT FROM OLD.autonomy_level
       OR NEW.allowed_job_types IS DISTINCT FROM OLD.allowed_job_types
       OR NEW.allowed_candidate_event_types IS DISTINCT FROM OLD.allowed_candidate_event_types
       OR NEW.auto_approve_event_types IS DISTINCT FROM OLD.auto_approve_event_types
       OR NEW.requires_human_review IS DISTINCT FROM OLD.requires_human_review
       OR NEW.post_audit_sample_rate IS DISTINCT FROM OLD.post_audit_sample_rate
       OR NEW.max_cost_per_run IS DISTINCT FROM OLD.max_cost_per_run
       OR NEW.max_daily_cost IS DISTINCT FROM OLD.max_daily_cost
       OR NEW.validator_version IS DISTINCT FROM OLD.validator_version
       OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
    THEN
        RAISE EXCEPTION 'agent version semantic fields are immutable; create a new version';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_versions_semantic_immutable ON agent_versions;
CREATE TRIGGER agent_versions_semantic_immutable
BEFORE UPDATE OR DELETE ON agent_versions
FOR EACH ROW EXECUTE FUNCTION protect_agent_version_semantics();

-- 影子模式不得生成候选（数据库防线）
CREATE OR REPLACE FUNCTION reject_shadow_candidate()
RETURNS trigger AS $$
DECLARE
    v_mode TEXT;
BEGIN
    IF NEW.source_run_id IS NOT NULL THEN
        SELECT run_mode INTO v_mode FROM agent_runs WHERE id = NEW.source_run_id;
        IF v_mode = 'shadow' THEN
            RAISE EXCEPTION 'shadow runs cannot create candidate events';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS candidate_no_shadow_source ON candidate_events;
CREATE TRIGGER candidate_no_shadow_source
BEFORE INSERT ON candidate_events
FOR EACH ROW EXECUTE FUNCTION reject_shadow_candidate();

CREATE INDEX IF NOT EXISTS idx_agent_runs_comparison
ON agent_runs(comparison_group_id, run_mode, started_at);

CREATE INDEX IF NOT EXISTS idx_egress_access_job
ON egress_access_logs(job_id, created_at);

CREATE INDEX IF NOT EXISTS idx_operational_outbox_pending
ON operational_event_outbox(status, created_at);
