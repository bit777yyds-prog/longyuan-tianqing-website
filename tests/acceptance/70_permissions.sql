-- ============================================================
-- 70 权限真防线  §26.2 + 验收指令 四.4
-- 判据：worker 账户 INSERT event_ledger 失败、INSERT candidate_events 成功；
--       应用/worker 不以 owner/superuser 连库；逐账户越权动作必须失败。
-- 依赖：tests/fixtures/000_test_roles.sql 已创建角色与 GRANT。
--       （被测 db/init 本身【缺】CREATE ROLE/GRANT ⇒ 见 TEST_REPORT.md 四.4 = FAIL；
--         本文件验证的是"角色到位后约束是否真的生效"。）
-- 运行：以 superuser 连接，通过 SET ROLE 降权模拟各账户；--single-transaction 回滚。
-- ============================================================
\set ON_ERROR_STOP on

-- 前置：角色是否存在（缺则本组无法执行，明确报出）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='worker_candidate_rw')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='approval_event_writer') THEN
        RAISE EXCEPTION 'BLOCKED 四.4: 缺测试角色；请先加载 tests/fixtures/000_test_roles.sql';
    END IF;
END $$;

-- 70a worker 越权写 event_ledger 必须失败（insufficient_privilege）
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE worker_candidate_rw;
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'worker-illegal-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL 四.4a: worker 账户竟能写 event_ledger（权限防线失效）'; END IF;
    RAISE NOTICE 'PASS 四.4a: worker 写 event_ledger 被拒（insufficient_privilege）';
END $$;

-- 70b worker 可写 candidate_events（primary run 来源，非外部内容）
DO $$
DECLARE ok boolean := false;
BEGIN
    SET LOCAL ROLE worker_candidate_rw;
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000701', '{"n":1}'::jsonb);
        ok := true;
    EXCEPTION WHEN others THEN ok := false;
    END;
    RESET ROLE;
    IF NOT ok THEN RAISE EXCEPTION 'FAIL 四.4b: worker 无法写 candidate_events（隔离过严或授权缺失）'; END IF;
    RAISE NOTICE 'PASS 四.4b: worker 可写 candidate_events';
END $$;

-- 70c worker 越权改 state_projections 必须失败
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE worker_candidate_rw;
    BEGIN
        INSERT INTO state_projections (object_type, object_id, current_state, last_event_id)
        VALUES ('deliverable', '00000000-0000-0000-0000-0000000000d1', 'reviewed',
                '00000000-0000-0000-0000-000000000401');
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL 四.4c: worker 竟能写 state_projections'; END IF;
    RAISE NOTICE 'PASS 四.4c: worker 写 state_projections 被拒';
END $$;

-- 70d 正向对照：approval_event_writer 可写 event_ledger
DO $$
DECLARE ok boolean := false;
BEGIN
    SET LOCAL ROLE approval_event_writer;
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'writer-ok-'||gen_random_uuid()::text, now(), '1.0','1.0','{"by":"writer"}'::jsonb);
        ok := true;
    EXCEPTION WHEN others THEN ok := false;
    END;
    RESET ROLE;
    IF NOT ok THEN RAISE EXCEPTION 'FAIL 四.4d: approval_event_writer 无法写 event_ledger（授权不足）'; END IF;
    RAISE NOTICE 'PASS 四.4d: approval_event_writer 可写 event_ledger';
END $$;

-- 70e readonly_analytics 越权写 candidate_events 必须失败
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE readonly_analytics;
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, proposed_payload)
        VALUES ('x', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501', '{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL 四.4e: 只读账户竟能写 candidate_events'; END IF;
    RAISE NOTICE 'PASS 四.4e: 只读账户写入被拒';
END $$;
