-- ============================================================
-- 81 Phase 1A 独立复核（审计者编写，独立于实现方的 80_phase1a_governance.sql）
-- 依据：治理总纲宪法第十二条——验收不得依赖被验收方自证。
-- 仅覆盖实现方 Phase 1A 新增、且未被审计者既有 10/60/70 覆盖的四项守卫：
--   A. reviews 只读绑定（仅 approval_event_writer 可维护，且必须挂 source_event_id）
--   B. model_configs 语义字段不可原地修改
--   C. replay run 禁止产生候选
--   D. event_ledger.event_type 未注册即拒
-- 运行：psql --single-transaction
-- ============================================================
\set ON_ERROR_STOP on

-- A. reviews 只读绑定 --------------------------------------------------
-- A1：非 approval_event_writer（此处 admin/current_user≠writer）写 reviews 必须被守卫拒绝
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        INSERT INTO reviews (task_id, deliverable_id, reviewer_actor_id, decision, source_event_id)
        VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
                '00000000-0000-0000-0000-0000000000a1', 'pass', '00000000-0000-0000-0000-000000000401');
    EXCEPTION WHEN others THEN
        blocked := (SQLERRM LIKE '%read-model%' OR SQLERRM LIKE '%approval_event_writer%');
        IF NOT blocked THEN
            RAISE EXCEPTION 'FAIL 81-A1: reviews 写入被拒但原因非只读守卫：%', SQLERRM;
        END IF;
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL 81-A1: 非 approval_event_writer 竟能写 reviews（第二验收写入路径未被封堵）';
    END IF;
    RAISE NOTICE 'PASS 81-A1: reviews 只读守卫拒绝非审批写入';
END $$;

-- A2：source_event_id 为 NOT NULL —— 无正式事件来源的 reviews 不可存在
DO $$
DECLARE is_nn text;
BEGIN
    SELECT is_nullable INTO is_nn FROM information_schema.columns
     WHERE table_name='reviews' AND column_name='source_event_id';
    IF is_nn IS DISTINCT FROM 'NO' THEN
        RAISE EXCEPTION 'FAIL 81-A2: reviews.source_event_id 允许为空，投影可脱离正式事件';
    END IF;
    RAISE NOTICE 'PASS 81-A2: reviews.source_event_id NOT NULL';
END $$;

-- B. model_configs 语义不可原地修改 ----------------------------------
DO $$
DECLARE blocked boolean := false;
BEGIN
    INSERT INTO model_configs (id, provider, model_name, provider_region, data_processing_region)
    VALUES ('00000000-0000-0000-0000-0000000000e9', 'mock', 'audit-probe', 'CN', 'CN');
    BEGIN
        UPDATE model_configs SET model_name = 'hot-edited' WHERE id='00000000-0000-0000-0000-0000000000e9';
    EXCEPTION WHEN others THEN blocked := (SQLERRM LIKE '%semantic%' OR SQLERRM LIKE '%immutable%');
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL 81-B: model_configs 语义字段(model_name)可被原地热改';
    END IF;
    RAISE NOTICE 'PASS 81-B: model_configs 语义字段不可原地修改';
END $$;

-- C. replay run 禁止产生候选 -----------------------------------------
DO $$
DECLARE inserted boolean := false;
BEGIN
    INSERT INTO agent_runs (id, job_id, agent_version_id, trace_id, provider, model_name,
                            status, run_mode, replay_source_run_id)
    VALUES ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000601',
            '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000005a1',
            'mock', 'mock-model-v1', 'succeeded', 'replay', '00000000-0000-0000-0000-000000000701');
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-0000000007a1', '{}'::jsonb);
        inserted := true;
    EXCEPTION WHEN others THEN
        IF SQLERRM NOT LIKE '%replay%' THEN
            RAISE EXCEPTION 'FAIL 81-C: replay 候选被拒但原因非重放守卫：%', SQLERRM;
        END IF;
    END;
    IF inserted THEN RAISE EXCEPTION 'FAIL 81-C: replay run 竟能产生候选（重放不得重新生效）'; END IF;
    RAISE NOTICE 'PASS 81-C: replay run 无法产生候选';
END $$;

-- D. event_type 未注册即拒 -------------------------------------------
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('totally.unregistered', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'audit-unreg-'||gen_random_uuid()::text, now(), '1.0','1.0','{}'::jsonb);
    EXCEPTION WHEN foreign_key_violation THEN blocked := true;
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL 81-D: 未注册 event_type 可写入 event_ledger（模型/开发者可自造类型）';
    END IF;
    RAISE NOTICE 'PASS 81-D: 未注册 event_type 被 event_types 外键拒绝';
END $$;
