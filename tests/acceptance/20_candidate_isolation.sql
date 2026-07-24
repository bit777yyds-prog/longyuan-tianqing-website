-- ============================================================
-- 20 候选隔离  §26.2 + 验收指令 三.2
-- 判据：worker 账户 INSERT event_ledger 须失败、INSERT candidate_events 须成功
--       （跨角色部分见 70_permissions.sql）；未批准 candidate 不改变 state_projections。
-- 运行：psql --single-transaction
-- ============================================================
\set ON_ERROR_STOP on

-- 20a 候选事件可按结构写入（primary run 来源，非 shadow）
DO $$
BEGIN
    INSERT INTO candidate_events (id, proposed_event_type, actor_id, object_type, object_id,
                                  correlation_id, source_run_id, proposed_payload, status)
    VALUES ('00000000-0000-0000-0000-000000000801', 'deliverable.reviewed',
            '00000000-0000-0000-0000-0000000000a2', 'deliverable',
            '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
            '00000000-0000-0000-0000-000000000701',
            '{"suggested_decision":"manual_review"}'::jsonb, 'pending');
    RAISE NOTICE 'PASS 26.2b: candidate_events 可写入（pending）';
EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL 26.2b: candidate_events 写入失败：%', SQLERRM;
END $$;

-- 20b 未批准候选不得改变投影：插入 pending 候选后，该对象不应出现/变化于 state_projections
DO $$
DECLARE proj_count integer;
BEGIN
    SELECT count(*) INTO proj_count
    FROM state_projections
    WHERE object_type = 'deliverable'
      AND object_id = '00000000-0000-0000-0000-0000000000d1';
    IF proj_count <> 0 THEN
        RAISE EXCEPTION 'FAIL 26.2c: 存在 pending 候选却已出现 state_projections 记录（候选越过审批改变了投影）';
    END IF;
    RAISE NOTICE 'PASS 26.2c: 未批准候选未改变 state_projections';
END $$;

-- 20c 结构防线：state_projections.last_event_id 强制引用 event_ledger
--     ⇒ 投影只能由"已入账的正式事件"驱动，无法凭候选直接落地。
DO $$
DECLARE has_fk boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'state_projections'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'event_ledger'
    ) INTO has_fk;
    IF NOT has_fk THEN
        RAISE EXCEPTION 'FAIL 26.2d: state_projections 未强制外键引用 event_ledger，投影可脱离正式事件被写入';
    END IF;
    RAISE NOTICE 'PASS 26.2d: state_projections.last_event_id 外键约束存在';
END $$;
