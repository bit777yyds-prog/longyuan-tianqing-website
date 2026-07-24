-- ============================================================
-- 30 幂等  §26.3 + 验收指令 三.3
-- 判据：同一 idempotency_key 重复请求只产生一条正式事件；
--       worker 重试不重复产生候选。
-- 运行：psql --single-transaction
-- ============================================================
\set ON_ERROR_STOP on

-- 30a event_ledger.idempotency_key 唯一约束存在（DB 级幂等基座）
DO $$
DECLARE has_uniq boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'event_ledger' AND c.contype = 'u'
          AND EXISTS (
            SELECT 1 FROM unnest(c.conkey) k
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
            WHERE a.attname = 'idempotency_key')
    ) INTO has_uniq;
    IF NOT has_uniq THEN
        RAISE EXCEPTION 'FAIL 26.3a: event_ledger.idempotency_key 缺唯一约束';
    END IF;
    RAISE NOTICE 'PASS 26.3a: event_ledger.idempotency_key 唯一约束存在';
END $$;

-- 30b 重复 idempotency_key 的第二次插入必须失败（只留一条正式事件）
DO $$
DECLARE dup_blocked boolean := false; cnt integer;
BEGIN
    INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                              idempotency_key, occurred_at, schema_version, policy_version, payload)
    VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
            '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
            'idem-dup-test-1', now(), '1.0', '1.0', '{"n":1}'::jsonb);
    BEGIN
        INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                                  idempotency_key, occurred_at, schema_version, policy_version, payload)
        VALUES ('deliverable.reviewed', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
                '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
                'idem-dup-test-1', now(), '1.0', '1.0', '{"n":2}'::jsonb);
    EXCEPTION WHEN unique_violation THEN
        dup_blocked := true;
    END;
    IF NOT dup_blocked THEN
        RAISE EXCEPTION 'FAIL 26.3b: 同一 idempotency_key 允许了第二条正式事件';
    END IF;
    SELECT count(*) INTO cnt FROM event_ledger WHERE idempotency_key = 'idem-dup-test-1';
    IF cnt <> 1 THEN
        RAISE EXCEPTION 'FAIL 26.3b: idempotency_key 对应正式事件数=% (应为1)', cnt;
    END IF;
    RAISE NOTICE 'PASS 26.3b: 重复 idempotency_key 只留一条正式事件';
END $$;

-- 30c agent_jobs.idempotency_key 唯一（worker 重试不重复建 Job/候选的基座）
DO $$
DECLARE has_uniq boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'agent_jobs' AND c.contype = 'u'
          AND EXISTS (SELECT 1 FROM unnest(c.conkey) k
                      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k
                      WHERE a.attname='idempotency_key')
    ) INTO has_uniq;
    IF NOT has_uniq THEN
        RAISE EXCEPTION 'FAIL 26.3c: agent_jobs.idempotency_key 缺唯一约束（worker 重试可能重复建 Job）';
    END IF;
    RAISE NOTICE 'PASS 26.3c: agent_jobs.idempotency_key 唯一约束存在';
END $$;

-- 注：candidate_events 无自然幂等键（无 UNIQUE），"worker 重试不重复产生候选"
--     依赖应用层（按 source_run_id / correlation_id 去重）。当前无应用代码 ⇒ 该行为不可测。
--     见 TEST_REPORT.md 三.3：DB 基座 PASS，应用层去重 未实现。
DO $$
DECLARE has_dedup boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
        WHERE t.relname='candidate_events' AND c.contype IN ('u','p')
          AND EXISTS (SELECT 1 FROM unnest(c.conkey) k
                      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k
                      WHERE a.attname IN ('source_run_id','idempotency_key'))
    ) INTO has_dedup;
    IF NOT has_dedup THEN
        RAISE WARNING '注意 26.3d: candidate_events 无去重唯一键；worker 重试防重依赖尚未实现的应用层';
    ELSE
        RAISE NOTICE 'PASS 26.3d: candidate_events 具备去重唯一键';
    END IF;
END $$;
