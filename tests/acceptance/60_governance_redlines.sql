-- ============================================================
-- 60 治理红线（DB 可强制部分）  验收指令 四.1 / 四.2 / 四.3 / 四.8 / 四.9
-- 说明：四.4 权限见 70_permissions.sql；四.5/四.6/四.7/四.10 为应用层，
--       当前无代码，见 TEST_REPORT.md（未实现）。
-- 运行：psql --single-transaction
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- 四.1 A 级语义一致 / 安全默认 ----------
-- 新建 Agent 版本默认 A1、auto_approve_event_types 为空、requires_human_review=true
DO $$
DECLARE lvl text; aae jsonb; rhr boolean;
BEGIN
    INSERT INTO agent_versions (id, agent_definition_id, version, model_config_id, prompt_version_id)
    VALUES ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-000000000101',
            'defaults-probe', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1');
    SELECT autonomy_level, auto_approve_event_types, requires_human_review
      INTO lvl, aae, rhr FROM agent_versions WHERE id='00000000-0000-0000-0000-0000000009f1';
    IF lvl <> 'A1' THEN RAISE EXCEPTION 'FAIL 四.1a: 默认 autonomy_level=% (应 A1)', lvl; END IF;
    IF aae <> '[]'::jsonb THEN RAISE EXCEPTION 'FAIL 四.1b: 默认 auto_approve_event_types=% (应为空)', aae; END IF;
    IF rhr IS NOT true THEN RAISE EXCEPTION 'FAIL 四.1c: 默认 requires_human_review=% (应 true)', rhr; END IF;
    RAISE NOTICE 'PASS 四.1: 新 Agent 版本默认 A1 / 空自动批准 / 需人工复核';
END $$;

-- autonomy_level 取值域须为 A0–A3（与网站规划 §自治级别一致）
DO $$
DECLARE bad_ok boolean := false;
BEGIN
    BEGIN
        INSERT INTO agent_versions (id, agent_definition_id, version, model_config_id, prompt_version_id, autonomy_level)
        VALUES ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-000000000101',
                'bad-level', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 'A9');
        bad_ok := true;
    EXCEPTION WHEN check_violation THEN bad_ok := false;
    END;
    IF bad_ok THEN RAISE EXCEPTION 'FAIL 四.1d: autonomy_level 接受了越界值 A9'; END IF;
    RAISE NOTICE 'PASS 四.1d: autonomy_level 约束为 A0–A3';
END $$;

-- ---------- 四.2 唯一事实源 / reviews 表 ----------
-- 判据：reviews 已删除，或已改为纯投影（无独立验收写入路径）。
-- 现状：reviews 表仍在，带 decision CHECK，且【无】last_event_id 外键把它绑定为
--       event_ledger 的投影 ⇒ 结构上仍是第二条可独立写入的验收决策路径。
DO $$
DECLARE reviews_exists boolean; has_event_fk boolean;
BEGIN
    reviews_exists := to_regclass('public.reviews') IS NOT NULL;
    IF NOT reviews_exists THEN
        RAISE NOTICE 'PASS 四.2: reviews 表已删除';
        RETURN;
    END IF;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
        WHERE tc.table_name='reviews' AND tc.constraint_type='FOREIGN KEY'
          AND ccu.table_name='event_ledger'
    ) INTO has_event_fk;
    IF NOT has_event_fk THEN
        RAISE EXCEPTION 'FAIL 四.2: reviews 表仍存在且未绑定为 event_ledger 投影（含独立 decision 列，构成第二条验收写入路径；交作者裁定"读模型"设计是否达标 + 交实现方补强制约束）';
    END IF;
    RAISE NOTICE 'PASS 四.2: reviews 已改为绑定正式事件的纯投影';
END $$;

-- ---------- 四.3 触发规则不硬编码 ----------
DO $$
DECLARE tbl_ok boolean; used_ok boolean; ver_col boolean;
BEGIN
    tbl_ok := to_regclass('public.agent_trigger_rules') IS NOT NULL;
    IF NOT tbl_ok THEN RAISE EXCEPTION 'FAIL 四.3a: 缺 agent_trigger_rules 表'; END IF;
    SELECT count(*)>0 INTO used_ok FROM agent_trigger_rules;   -- 种子已插入一条
    IF NOT used_ok THEN RAISE EXCEPTION 'FAIL 四.3b: agent_trigger_rules 为空，触发规则未被实际使用'; END IF;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='agent_trigger_rules' AND column_name='policy_version') INTO ver_col;
    IF NOT ver_col THEN RAISE EXCEPTION 'FAIL 四.3c: agent_trigger_rules 无 policy_version，变更无法版本化'; END IF;
    RAISE NOTICE 'PASS 四.3: 触发规则以数据行配置、被使用、带 policy_version';
    RAISE WARNING '注意 四.3: 触发规则无不可变触发器/生命周期表，变更"留痕"依赖应用层（尚未实现）';
END $$;

-- ---------- 四.8 Prompt 注入 / 外部内容永不自动批准（DB 防线）----------
-- 候选层 CHECK：contains_external_content=true 时 auto_approval_eligible 必须为 false
DO $$
DECLARE bad_ok boolean := false;
BEGIN
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload,
                                      contains_external_content, auto_approval_eligible)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000701', '{}'::jsonb, true, true);
        bad_ok := true;
    EXCEPTION WHEN check_violation THEN bad_ok := false;
    END;
    IF bad_ok THEN RAISE EXCEPTION 'FAIL 四.8a: 外部内容候选被允许标记为可自动批准'; END IF;
    RAISE NOTICE 'PASS 四.8a: 外部内容候选禁止自动批准（candidate CHECK 生效）';
END $$;

-- 触发规则层 CHECK：外部内容任务类型不得配置自动批准
DO $$
DECLARE bad_ok boolean := false;
BEGIN
    BEGIN
        INSERT INTO agent_trigger_rules (event_type, job_type, agent_version_id,
                                         contains_external_content, allow_auto_approve)
        VALUES ('deliverable.submitted', 'review.precheck',
                '00000000-0000-0000-0000-000000000201', true, true);
        bad_ok := true;
    EXCEPTION WHEN check_violation THEN bad_ok := false;
    END;
    IF bad_ok THEN RAISE EXCEPTION 'FAIL 四.8b: 允许为外部内容任务配置自动批准（应被拒绝）'; END IF;
    RAISE NOTICE 'PASS 四.8b: 外部内容触发规则禁止自动批准（trigger-rule CHECK 生效）';
END $$;

-- ---------- 四.9 重放/影子语义（DB 防线）----------
-- 影子 Run 不得产生候选
DO $$
DECLARE inserted boolean := false;
BEGIN
    BEGIN
        INSERT INTO candidate_events (proposed_event_type, actor_id, object_type, object_id,
                                      correlation_id, source_run_id, proposed_payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a2', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                '00000000-0000-0000-0000-000000000702', '{}'::jsonb);  -- 702 = shadow run
        inserted := true;
    EXCEPTION WHEN others THEN
        IF SQLERRM NOT LIKE '%shadow%' THEN
            RAISE EXCEPTION 'FAIL 四.9a: shadow 候选被拒但原因非影子守卫：%', SQLERRM;
        END IF;
    END;
    IF inserted THEN RAISE EXCEPTION 'FAIL 四.9a: 影子 Run 竟能产生候选'; END IF;
    RAISE NOTICE 'PASS 四.9a: 影子 Run 无法产生候选（DB 触发器生效）';
END $$;

-- 重放语义字段就位：run_mode 支持 replay/rerun，且有 replayed_from_stored_output 标记
DO $$
DECLARE has_col boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='agent_runs' AND column_name='replayed_from_stored_output') INTO has_col;
    IF NOT has_col THEN RAISE EXCEPTION 'FAIL 四.9b: agent_runs 缺 replayed_from_stored_output（无法区分重放是否重调模型）'; END IF;
    PERFORM 1;  -- run_mode CHECK 含 replay/rerun 由 Schema 保证
    RAISE NOTICE 'PASS 四.9b: 重放/重跑区分字段就位（行为正确性需应用层，见报告 四.9）';
END $$;
