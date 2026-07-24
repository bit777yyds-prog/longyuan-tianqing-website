-- ============================================================
-- Migration: prompt_versions 专属不可变守卫
-- 说明：
--   - 001_agent_native_schema.sql 中的 prompt_versions_no_mutation 触发器
--     复用了 event_ledger 的 prevent_event_mutation() 函数，导致错误消息为
--     "event_ledger is append-only"，对 prompt_versions 具有误导性。
--   - 本迁移提供专属守卫函数与准确错误消息，不修改 event_ledger 原有提示。
-- ============================================================

BEGIN;

-- 专属守卫：prompt_versions 语义字段不可原地热改
CREATE OR REPLACE FUNCTION protect_prompt_version()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'prompt_versions are immutable; create a new version';
END;
$$ LANGUAGE plpgsql;

-- 替换原有触发器，使用专属守卫函数
DROP TRIGGER IF EXISTS prompt_versions_no_mutation ON prompt_versions;
CREATE TRIGGER prompt_versions_no_mutation
BEFORE UPDATE OR DELETE ON prompt_versions
FOR EACH ROW EXECUTE FUNCTION protect_prompt_version();

COMMIT;
