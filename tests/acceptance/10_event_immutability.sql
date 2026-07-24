-- ============================================================
-- 10 事件不可变  §26.1 + 验收指令 三.1
-- 判据：对 event_ledger 的 UPDATE / DELETE / TRUNCATE 均须失败；
--       更正事件（event.corrected 等）可正常插入。
-- 运行：psql --single-transaction（跑完 ROLLBACK，不落数据、不删数据）
-- ============================================================
\set ON_ERROR_STOP on

-- 10a UPDATE 必须被拒绝
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        UPDATE event_ledger SET event_type = 'tampered'
        WHERE id = '00000000-0000-0000-0000-000000000401';
    EXCEPTION WHEN others THEN
        blocked := (SQLERRM LIKE '%append-only%');
        IF NOT blocked THEN
            RAISE EXCEPTION 'FAIL 26.1a: UPDATE 被拒但原因非 append-only 触发器：%', SQLERRM;
        END IF;
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL 26.1a: UPDATE event_ledger 未被阻止（正式事件被篡改）';
    END IF;
    RAISE NOTICE 'PASS 26.1a: UPDATE event_ledger 被 append-only 触发器阻止';
END $$;

-- 10b DELETE 必须被拒绝
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        DELETE FROM event_ledger WHERE id = '00000000-0000-0000-0000-000000000401';
    EXCEPTION WHEN others THEN
        blocked := (SQLERRM LIKE '%append-only%');
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL 26.1b: DELETE event_ledger 未被 append-only 触发器阻止';
    END IF;
    RAISE NOTICE 'PASS 26.1b: DELETE event_ledger 被阻止';
END $$;

-- 10c TRUNCATE 必须被拒绝（验收指令 三.1 明确要求；§26.1 未列，指令加严）
--     用 CASCADE 排除"因外键被引用"这一 *附带* 报错路径，
--     使唯一可能拦截者只剩 BEFORE TRUNCATE 触发器。
--     当前 Schema 只有 FOR EACH ROW BEFORE UPDATE/DELETE 触发器，
--     行级触发器不拦截 TRUNCATE ⇒ 预期此断言【失败】，交回实现方补
--     "CREATE TRIGGER ... BEFORE TRUNCATE ON event_ledger FOR EACH STATEMENT"。
DO $$
DECLARE blocked boolean := false;
BEGIN
    BEGIN
        TRUNCATE event_ledger CASCADE;
    EXCEPTION WHEN others THEN
        blocked := true;   -- 任何拒绝都算被挡住；下方再看是不是 append-only
        IF SQLERRM NOT LIKE '%append-only%' THEN
            RAISE EXCEPTION 'FAIL 26.1c: TRUNCATE 被拒但非 append-only 守卫（附带保护，不可靠）：%', SQLERRM;
        END IF;
    END;
    IF NOT blocked THEN
        RAISE EXCEPTION 'FAIL 26.1c: TRUNCATE event_ledger 未被阻止（缺 BEFORE TRUNCATE 守卫，事件总账可被清空）';
    END IF;
    RAISE NOTICE 'PASS 26.1c: TRUNCATE event_ledger 被阻止';
END $$;

-- 10d 更正事件必须可以插入（不可变 ≠ 不可追加更正）
DO $$
BEGIN
    INSERT INTO event_ledger (event_type, actor_id, object_type, object_id, correlation_id,
                              idempotency_key, occurred_at, schema_version, policy_version, payload)
    VALUES ('event.corrected', '00000000-0000-0000-0000-0000000000a1', 'deliverable',
            '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000501',
            'test-corrective-'||gen_random_uuid()::text, now(), '1.0', '1.0',
            '{"corrects":"...401","reason":"测试更正事件"}'::jsonb);
    RAISE NOTICE 'PASS 26.1d: 更正事件可插入';
EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL 26.1d: 更正事件插入被错误阻止：%', SQLERRM;
END $$;

-- 结束（无 COMMIT；由 --single-transaction 统一 ROLLBACK）
