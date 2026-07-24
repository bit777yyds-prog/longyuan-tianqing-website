-- 测试角色安全网 fixture（审计者维护）
-- ============================================================
-- 重要（2026-07-24 修订）：
--   Phase 1A 后，真实角色与最小权限授予已由 db/init/002_init_roles.sh 提供，
--   并在 harness 与 CI 中先于本文件执行。002 是【权威且唯一】的授权来源。
--
--   本文件【绝不】GRANT 任何表权限。早期版本曾 `GRANT SELECT ON ALL TABLES`
--   等，会叠加在真实 002 授权之上，导致最小权限验收被【掩盖】（并集越权仍通过）。
--   已移除全部 GRANT，仅保留"角色存在性"安全网，供无 002 的独立场景做 SET ROLE。
--
--   判据：权限行为完全依赖 002 的真实授权；若 002 未运行，正向权限用例应【失败】，
--         这正是期望信号，而非由本 fixture 补授权来掩盖。
-- ============================================================

-- 仅确保五个冻结角色存在（无 LOGIN 亦可被超级用户 SET ROLE）；不授予任何权限。
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['app_rw','worker_candidate_rw','scheduler_jobs_rw',
                             'approval_event_writer','app_readonly'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', r);
        END IF;
    END LOOP;
END $$;
