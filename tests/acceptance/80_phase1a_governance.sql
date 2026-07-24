-- ============================================================
-- 80 Phase 1A 治理硬化验收
-- 覆盖 Phase 1A 冻结裁决要求的数据库约束与角色权限
-- 运行：psql --single-transaction
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- 1. event_ledger TRUNCATE 防护 ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        TRUNCATE event_ledger CASCADE;
    EXCEPTION WHEN others THEN
        blocked := (SQLERRM LIKE '%append-only%');
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL P1A-1: TRUNCATE event_ledger 未被 append-only 守卫阻止';
    END IF;
    RAISE NOTICE 'PASS P1A-1: TRUNCATE event_ledger 被阻止';
END $$;

-- ---------- 2. 五个冻结角色存在且属性正确 ----------
DO $$
DECLARE expected text[] := ARRAY['app_rw','worker_candidate_rw','scheduler_jobs_rw','approval_event_writer','app_readonly'];
    r text; bad text := '';
BEGIN
    FOREACH r IN ARRAY expected LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            bad := bad || r || ' ';
        END IF;
    END LOOP;
    IF bad <> '' THEN
        RAISE EXCEPTION 'FAIL P1A-2a: 缺少冻结角色：%', bad;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ANY(expected)
               AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)) THEN
        RAISE EXCEPTION 'FAIL P1A-2b: 应用角色拥有 SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS';
    END IF;
    RAISE NOTICE 'PASS P1A-2: 五个冻结角色存在且属性最小化';
END $$;

-- ---------- 3. PUBLIC 无 public schema CREATE 权限 ----------
DO $$
DECLARE can_create boolean;
BEGIN
    SELECT has_schema_privilege('public', 'public', 'CREATE') INTO can_create;
    IF can_create THEN
        RAISE EXCEPTION 'FAIL P1A-3: PUBLIC 仍拥有 public schema CREATE 权限';
    END IF;
    RAISE NOTICE 'PASS P1A-3: PUBLIC 无 public schema CREATE 权限';
END $$;

-- ---------- 4. app_rw 不能写 event_ledger ----------
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE app_rw;
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('x', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'app-rw-illegal-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL P1A-4: app_rw 能写 event_ledger'; END IF;
    RAISE NOTICE 'PASS P1A-4: app_rw 写 event_ledger 被拒';
END $$;

-- ---------- 5. app_rw 不能写 candidate_events ----------
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE app_rw;
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload)
        VALUES ('x', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000701', '{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL P1A-5: app_rw 能写 candidate_events'; END IF;
    RAISE NOTICE 'PASS P1A-5: app_rw 写 candidate_events 被拒';
END $$;

-- ---------- 6. worker_candidate_rw 不能写 event_ledger ----------
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE worker_candidate_rw;
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('x', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'worker-illegal-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL P1A-6: worker_candidate_rw 能写 event_ledger'; END IF;
    RAISE NOTICE 'PASS P1A-6: worker_candidate_rw 写 event_ledger 被拒';
END $$;

-- ---------- 7. worker 只能写 pending candidate ----------
DO $$
DECLARE ok boolean := false; blocked boolean := false;
BEGIN
    SET LOCAL ROLE worker_candidate_rw;
    BEGIN
        INSERT INTO candidate_events (id, proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload, status)
        VALUES ('00000000-0000-0000-0000-000000000901', 'deliverable.reviewed',
                '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000701', '{}'::jsonb, 'pending');
        ok := true;
    EXCEPTION WHEN others THEN ok := false;
    END;
    BEGIN
        UPDATE candidate_events SET status = 'approved' WHERE id = '00000000-0000-0000-0000-000000000901';
    EXCEPTION WHEN insufficient_privilege THEN blocked := true;
    END;
    RESET ROLE;
    IF NOT ok THEN RAISE EXCEPTION 'FAIL P1A-7a: worker 无法写 pending candidate'; END IF;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-7b: worker 能改 candidate 状态'; END IF;
    RAISE NOTICE 'PASS P1A-7: worker 只能写 pending candidate 且不能改状态';
END $$;

-- ---------- 8. scheduler_jobs_rw 不能写 event_ledger ----------
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE scheduler_jobs_rw;
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('x', '00000000-0000-0000-0000-0000000000a3', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'scheduler-illegal-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL P1A-8: scheduler_jobs_rw 能写 event_ledger'; END IF;
    RAISE NOTICE 'PASS P1A-8: scheduler_jobs_rw 写 event_ledger 被拒';
END $$;

-- ---------- 9. approval_event_writer 可写 event_ledger ----------
DO $$
DECLARE ok boolean := false;
BEGIN
    SET LOCAL ROLE approval_event_writer;
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'writer-ok-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
        ok := true;
    EXCEPTION WHEN others THEN ok := false;
    END;
    RESET ROLE;
    IF NOT ok THEN RAISE EXCEPTION 'FAIL P1A-9: approval_event_writer 无法写 event_ledger'; END IF;
    RAISE NOTICE 'PASS P1A-9: approval_event_writer 可写 event_ledger';
END $$;

-- ---------- 10. approval_event_writer 可维护 reviews ----------
DO $$
DECLARE eid UUID;
BEGIN
    -- 先以 writer 插入一条正式事件作为 source
    SET LOCAL ROLE approval_event_writer;
    INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                              idempotency_key, occurred_at, schema_version, policy_version, payload)
    VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
            '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
            'review-source-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb)
    RETURNING id INTO eid;

    INSERT INTO reviews (task_id, deliverable_id, reviewer_actor_id, decision, source_event_id,
                         projection_version, projected_at)
    VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
            '00000000-0000-0000-0000-0000000000a1', 'pass', eid, 1, now());
    RESET ROLE;
    RAISE NOTICE 'PASS P1A-10: approval_event_writer 可维护 reviews';
EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL P1A-10: approval_event_writer 维护 reviews 失败：%', SQLERRM;
END $$;

-- ---------- 11. app_readonly 不能写任何表 ----------
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE app_readonly;
    BEGIN
        INSERT INTO projects (id, name) VALUES ('00000000-0000-0000-0000-0000000000b9', 'x');
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL P1A-11: app_readonly 能写 projects'; END IF;
    RAISE NOTICE 'PASS P1A-11: app_readonly 写 projects 被拒';
END $$;

-- ---------- 12. reviews.source_event_id 约束 ----------
DO $$
DECLARE has_nn boolean; has_uq boolean; has_fk boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='reviews' AND column_name='source_event_id' AND is_nullable='NO'
    ) INTO has_nn;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name='reviews' AND constraint_type='UNIQUE'
          AND constraint_name='reviews_source_event_id_unique'
    ) INTO has_uq;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
        WHERE tc.table_name='reviews' AND tc.constraint_type='FOREIGN KEY'
          AND ccu.table_name='event_ledger' AND ccu.column_name='id'
    ) INTO has_fk;
    IF NOT has_nn THEN RAISE EXCEPTION 'FAIL P1A-12a: reviews.source_event_id 非空约束缺失'; END IF;
    IF NOT has_uq THEN RAISE EXCEPTION 'FAIL P1A-12b: reviews.source_event_id 唯一约束缺失'; END IF;
    IF NOT has_fk THEN RAISE EXCEPTION 'FAIL P1A-12c: reviews.source_event_id 外键缺失'; END IF;
    RAISE NOTICE 'PASS P1A-12: reviews.source_event_id 非空/唯一/外键约束在位';
END $$;

-- ---------- 13. model_configs 语义字段不可原地修改 ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    INSERT INTO model_configs (id, provider, model_name, endpoint, provider_region, data_processing_region,
                               capability, pricing_policy, output_contract, verification_status)
    VALUES ('00000000-0000-0000-0000-0000000000e2', 'mock', 'mock-v2', 'http://localhost',
            'CN', 'CN', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'unverified');
    BEGIN
        UPDATE model_configs SET provider = 'changed' WHERE id = '00000000-0000-0000-0000-0000000000e2';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%semantic%' THEN blocked := true; END IF;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-13: model_configs provider 语义字段可被原地修改'; END IF;
    RAISE NOTICE 'PASS P1A-13: model_configs 语义字段不可原地修改';
END $$;

-- ---------- 14. model_configs 运营字段可更新 ----------
DO $$
DECLARE ok boolean := false;
BEGIN
    UPDATE model_configs SET verification_status = 'verified', verified_at = now(),
                             last_healthcheck_at = now(), last_error_at = now()
    WHERE id = '00000000-0000-0000-0000-0000000000e2';
    ok := true;
    RAISE NOTICE 'PASS P1A-14: model_configs 运营字段可更新';
EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL P1A-14: model_configs 运营字段更新被错误阻止：%', SQLERRM;
END $$;

-- ---------- 15. prompt_versions 语义字段不可原地修改 ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        UPDATE prompt_versions SET template = 'changed' WHERE id = '00000000-0000-0000-0000-0000000000f1';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%immutable%' THEN blocked := true; END IF;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-15: prompt_versions 语义字段可被原地修改'; END IF;
    RAISE NOTICE 'PASS P1A-15: prompt_versions 语义字段不可原地修改';
END $$;

-- ---------- 16. agent_versions 语义字段不可原地修改 ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        UPDATE agent_versions SET model_config_id = '00000000-0000-0000-0000-0000000000e2'
        WHERE id = '00000000-0000-0000-0000-000000000201';
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%semantic%' THEN blocked := true; END IF;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-16: agent_versions 语义字段可被原地修改'; END IF;
    RAISE NOTICE 'PASS P1A-16: agent_versions 语义字段不可原地修改';
END $$;

-- ---------- 17. replay run 不能产生 candidate ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    INSERT INTO agent_runs (id, job_id, agent_version_id, trace_id, provider, model_name,
                            status, run_mode, replay_source_run_id)
    VALUES ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000601',
            '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000503',
            'mock', 'mock-model-v1', 'succeeded', 'replay', '00000000-0000-0000-0000-000000000701');
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000703', '{}'::jsonb);
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%replay%' THEN blocked := true; END IF;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-17: replay run 能产生 candidate'; END IF;
    RAISE NOTICE 'PASS P1A-17: replay run 无法产生 candidate';
END $$;

-- ---------- 18. shadow run 不能产生 candidate（与 60_governance_redlines 重复，确保独立通过） ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000702', '{}'::jsonb);
    EXCEPTION WHEN others THEN
        IF SQLERRM LIKE '%shadow%' THEN blocked := true; END IF;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-18: shadow run 能产生 candidate'; END IF;
    RAISE NOTICE 'PASS P1A-18: shadow run 无法产生 candidate';
END $$;

-- ---------- 19. event_ledger event_type 外键阻止未注册类型 ----------
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('unregistered.event', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'unreg-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
    EXCEPTION WHEN foreign_key_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL P1A-19: 未注册 event_type 可写入 event_ledger'; END IF;
    RAISE NOTICE 'PASS P1A-19: event_ledger event_type 外键阻止未注册类型';
END $$;

-- ---------- 20. Worker 不得写入迁移后新增的 event_types 表（默认权限泄漏回归） ----------
DO $$
DECLARE denied boolean := false;
BEGIN
    SET LOCAL ROLE worker_candidate_rw;
    BEGIN
        INSERT INTO event_types (event_type, description, requires_approval)
        VALUES ('worker.forged.event', 'Worker 伪造事件类型', true);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    RESET ROLE;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL P1A-20: worker_candidate_rw 能写 event_types（默认权限泄漏）'; END IF;
    RAISE NOTICE 'PASS P1A-20: worker_candidate_rw 写 event_types 被拒';
END $$;


