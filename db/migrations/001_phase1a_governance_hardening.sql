-- ============================================================
-- Migration: Phase 1A 数据库治理硬化
-- 权威来源：手写 SQL（Drizzle Kit 仅作组织引用）
-- 目标：
--   1. event_ledger 禁止 TRUNCATE
--   2. reviews 绑定为正式事件读模型
--   3. model_configs 语义版本保护
--   4. replay run 禁止产生 candidate
--   5. event_types 注册表 + event_ledger 外键
--
-- 说明：
--   - event_types 保留，来源：IMPLEMENTATION_PLAN.md §2.2/§2.3 S10/§3.7/§3.11
--     及 docs/handoffs/phase-1a-preimplementation-handoff.md §8（审批账户必读）。
--   - public_contents 明确不属于 Phase 1A，已从本轮迁移移除。
-- ============================================================

BEGIN;

-- ============================================================
-- 1. event_ledger TRUNCATE 防护（语句级）
-- ============================================================
DROP TRIGGER IF EXISTS event_ledger_no_truncate ON event_ledger;
CREATE TRIGGER event_ledger_no_truncate
BEFORE TRUNCATE ON event_ledger
FOR EACH STATEMENT EXECUTE FUNCTION prevent_event_mutation();

-- 对所有应用角色撤销 TRUNCATE（与触发器形成纵深）
REVOKE TRUNCATE ON TABLE event_ledger
    FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;

-- ============================================================
-- 2. reviews 正式事件读模型改造
-- ============================================================
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS source_event_id UUID,
    ADD COLUMN IF NOT EXISTS projection_version BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS projected_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 为已存在但缺少 source_event_id 的数据提供占位（不应有生产数据）
UPDATE reviews SET source_event_id = '00000000-0000-0000-0000-000000000000'
WHERE source_event_id IS NULL;

ALTER TABLE reviews
    ALTER COLUMN source_event_id SET NOT NULL,
    ADD CONSTRAINT reviews_source_event_id_fk
        FOREIGN KEY (source_event_id) REFERENCES event_ledger(id),
    ADD CONSTRAINT reviews_source_event_id_unique
        UNIQUE (source_event_id);

CREATE INDEX IF NOT EXISTS idx_reviews_source_event ON reviews(source_event_id);

-- reviews 仅允许 approval_event_writer 写入（由 002_init_roles.sh 控制）
-- 这里通过触发器额外阻止非 approval_event_writer 的 INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION reviews_readonly_guard()
RETURNS trigger AS $$
BEGIN
    IF current_user <> 'approval_event_writer' THEN
        RAISE EXCEPTION 'reviews is a read-model of event_ledger; only approval_event_writer may maintain it';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_readonly_guard_trigger ON reviews;
CREATE TRIGGER reviews_readonly_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION reviews_readonly_guard();

-- ============================================================
-- 3. model_configs 语义版本保护
-- ============================================================
ALTER TABLE model_configs
    ADD COLUMN IF NOT EXISTS endpoint TEXT,
    ADD COLUMN IF NOT EXISTS capability JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS pricing_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS output_contract JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_healthcheck_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION protect_model_config_semantics()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'model_configs are immutable; create a new version or use lifecycle events';
    END IF;
    IF NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.model_name IS DISTINCT FROM OLD.model_name
       OR NEW.endpoint IS DISTINCT FROM OLD.endpoint
       OR NEW.provider_region IS DISTINCT FROM OLD.provider_region
       OR NEW.data_processing_region IS DISTINCT FROM OLD.data_processing_region
       OR NEW.data_retention_policy IS DISTINCT FROM OLD.data_retention_policy
       OR NEW.capability IS DISTINCT FROM OLD.capability
       OR NEW.pricing_policy IS DISTINCT FROM OLD.pricing_policy
       OR NEW.output_contract IS DISTINCT FROM OLD.output_contract
    THEN
        RAISE EXCEPTION 'model_config semantic fields are immutable; create a new version';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS model_configs_semantic_immutable ON model_configs;
CREATE TRIGGER model_configs_semantic_immutable
BEFORE UPDATE OR DELETE ON model_configs
FOR EACH ROW EXECUTE FUNCTION protect_model_config_semantics();

-- ============================================================
-- 4. replay run 禁止产生 candidate_events
-- ============================================================
CREATE OR REPLACE FUNCTION reject_replay_candidate()
RETURNS trigger AS $$
DECLARE v_mode TEXT;
BEGIN
    IF NEW.source_run_id IS NOT NULL THEN
        SELECT run_mode INTO v_mode FROM agent_runs WHERE id = NEW.source_run_id;
        IF v_mode = 'replay' THEN
            RAISE EXCEPTION 'replay runs cannot create candidate events';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS candidate_no_replay_source ON candidate_events;
CREATE TRIGGER candidate_no_replay_source
BEFORE INSERT ON candidate_events
FOR EACH ROW EXECUTE FUNCTION reject_replay_candidate();

-- Worker 只能写 pending candidate：通过权限控制 + 触发器兜底
CREATE OR REPLACE FUNCTION candidate_status_worker_guard()
RETURNS trigger AS $$
BEGIN
    IF current_user = 'worker_candidate_rw' AND NEW.status <> 'pending' THEN
        RAISE EXCEPTION 'worker can only create pending candidate events';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS candidate_status_worker_guard_trigger ON candidate_events;
CREATE TRIGGER candidate_status_worker_guard_trigger
BEFORE INSERT OR UPDATE ON candidate_events
FOR EACH ROW EXECUTE FUNCTION candidate_status_worker_guard();

-- ============================================================
-- 5. event_types 注册表 + event_ledger 外键
-- ============================================================
CREATE TABLE IF NOT EXISTS event_types (
    event_type TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    schema_version TEXT NOT NULL DEFAULT '1.0',
    payload_schema JSONB,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 注册首期已知事件类型（避免加外键时现有数据冲突）
INSERT INTO event_types (event_type, description, requires_approval) VALUES
    ('deliverable.submitted', '交付物提交', true),
    ('deliverable.reviewed', '交付物验收', true),
    ('event.corrected', '更正事件', true),
    ('review.recommended', 'Agent 初判推荐', true),
    ('review.passed', '验收通过', true),
    ('review.rework', '需返工', true),
    ('review.rejected', '验收拒绝', true),
    ('task.created', '任务创建', true),
    ('agent.run.failed', 'Agent 运行失败', false),
    ('agent.job.dead_lettered', 'Agent Job 死信', false),
    ('agent.timeout', 'Agent 调用超时', false),
    ('agent.output_validation_failed', 'Agent 输出校验失败', false),
    ('agent.language_validation_failed', 'Agent 语言校验失败', false),
    ('agent.egress_blocked', 'Agent 出站被阻止', false),
    ('agent.cost_limit_exceeded', 'Agent 成本超限', false),
    ('agent.provider_unavailable', 'Agent 供应商不可用', false)
ON CONFLICT (event_type) DO NOTHING;

-- 先清理未注册的事件类型（理论上无数据）
-- 加外键前确保所有 event_type 已注册
ALTER TABLE event_ledger
    DROP CONSTRAINT IF EXISTS event_ledger_event_type_fk,
    ADD CONSTRAINT event_ledger_event_type_fk
        FOREIGN KEY (event_type) REFERENCES event_types(event_type);

-- operational_event_outbox 同样受 event_types 约束
ALTER TABLE operational_event_outbox
    DROP CONSTRAINT IF EXISTS operational_event_outbox_event_type_fk,
    ADD CONSTRAINT operational_event_outbox_event_type_fk
        FOREIGN KEY (event_type) REFERENCES event_types(event_type);

-- ============================================================
-- 6. event_types 显式权限（新增表默认不继承应用角色权限）
-- ============================================================
GRANT SELECT ON TABLE event_types TO app_rw, approval_event_writer, app_readonly;

-- ============================================================
-- 7. 收尾：再次确认 PUBLIC 无 public schema CREATE 权限
-- ============================================================
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

COMMIT;
