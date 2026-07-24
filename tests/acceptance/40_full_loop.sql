-- ============================================================
-- 40 完整闭环  §26.4（**唯一判据**）+ 验收指令 三.4
-- 链条：任务创建 → 用户提交 → event 入账 → job 生成 → worker 运行
--       → candidate 写回 → 人工审批 → event 入账 → projection 更新；
--       全过程可从 event_ledger / agent_runs / approvals 完整回放。
-- 运行：psql --single-transaction
-- ------------------------------------------------------------
-- 说明：端到端闭环需要应用组件（Domain Service / Worker / 审批服务 /
--       Outbox Consumer / Projection Applier）。当前仓库 src/ 为空
--       （见 IMPLEMENTATION_PLAN.md S4/S5/S7/S9，Phase 6 才实现）。
--       因此本文件先做 *结构就位* 校验（应 PASS），最后给出 *行为闭环*
--       的明确红灯（应 FAIL），标记唯一判据【未达成 / 未实现】。
-- ============================================================
\set ON_ERROR_STOP on

-- 40-struct 各链节的表与关键外键就位（证明 Schema 能承载闭环）
DO $$
DECLARE missing text := '';
    rel text;
    rels text[] := ARRAY['tasks','deliverables','event_ledger','agent_trigger_rules',
                         'agent_jobs','agent_runs','candidate_events','approvals','state_projections'];
BEGIN
    FOREACH rel IN ARRAY rels LOOP
        IF to_regclass('public.'||rel) IS NULL THEN
            missing := missing || rel || ' ';
        END IF;
    END LOOP;
    IF missing <> '' THEN
        RAISE EXCEPTION 'FAIL 26.4-struct: 闭环所需表缺失：%', missing;
    END IF;
    RAISE NOTICE 'PASS 26.4-struct: 闭环 9 张表全部就位';
END $$;

-- 40-chain 回放锚点校验：源事件 → job → run → (候选) 的引用链可追溯
DO $$
DECLARE ok boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM event_ledger e
        JOIN agent_jobs j  ON j.source_event_id = e.id
        JOIN agent_runs  r ON r.job_id = j.id
        WHERE e.id = '00000000-0000-0000-0000-000000000401'
    ) INTO ok;
    IF NOT ok THEN
        RAISE EXCEPTION 'FAIL 26.4-chain: 源事件→job→run 引用链断裂，无法回放';
    END IF;
    RAISE NOTICE 'PASS 26.4-chain: event→job→run 引用链可追溯';
END $$;

-- 40-behavior 行为闭环（唯一判据本体）：需应用组件自动完成
--   deliverable.submitted ⇒ 触发规则命中 ⇒ 自动建 Job ⇒ Worker 跑出候选
--   ⇒ 人工审批写正式事件 ⇒ 投影更新。
-- 检测"是否已被自动跑通"的可观测证据：
--   (1) 由审批产生的 deliverable.reviewed 正式事件；
--   (2) 对应 approvals 记录；
--   (3) 对应 state_projections 更新。
-- 当前无应用代码，这些证据不存在 ⇒ 预期【FAIL / 未实现】。
DO $$
DECLARE reviewed_events int; approvals_cnt int; proj_cnt int;
BEGIN
    SELECT count(*) INTO reviewed_events FROM event_ledger
        WHERE event_type = 'deliverable.reviewed'
          AND object_id = '00000000-0000-0000-0000-0000000000d1'
          AND idempotency_key NOT LIKE 'idem-dup-test%';   -- 排除 30 号测试残留
    SELECT count(*) INTO approvals_cnt FROM approvals a
        JOIN candidate_events ce ON ce.id = a.candidate_event_id
        WHERE ce.object_id = '00000000-0000-0000-0000-0000000000d1';
    SELECT count(*) INTO proj_cnt FROM state_projections
        WHERE object_id = '00000000-0000-0000-0000-0000000000d1';

    IF reviewed_events = 0 OR approvals_cnt = 0 OR proj_cnt = 0 THEN
        RAISE EXCEPTION
          'FAIL 26.4（唯一判据·未达成）: 端到端自动闭环未跑通 — 审批事件=%, 审批记录=%, 投影=%。缺应用组件（Worker/审批服务/Outbox/投影更新，见 Phase 6）。',
          reviewed_events, approvals_cnt, proj_cnt;
    END IF;
    RAISE NOTICE 'PASS 26.4（唯一判据）: 完整闭环可回放';
END $$;
