-- ============================================================
-- 50 恢复  §26.5 + 验收指令 三.5
-- 判据：从备份恢复后事件数量与哈希一致；文件引用可访问；
--       Agent 版本与 Prompt 版本仍可追溯。
-- ------------------------------------------------------------
-- 恢复演练本质是【流程级】（pg_dump / 恢复 / 比对），SQL 单文件无法自证。
-- 这里提供恢复后应满足的 *不变量校验*，供 run_all 在"恢复到新库"后调用比对。
-- 另见 harness/run_all.sh 的 --recovery 模式（起第二个容器恢复 dump 再跑本文件）。
-- ============================================================
\set ON_ERROR_STOP on

-- 50a 事件总账指纹（数量 + 有序哈希链）。恢复前后应一致。
--     以 NOTICE 打印，run_all 在恢复库再次执行并 diff。
DO $$
DECLARE n bigint; digest text;
BEGIN
    SELECT count(*),
           encode(digest(string_agg(coalesce(payload_sha256, md5(payload::text)), ',' ORDER BY recorded_at, id), 'sha256'), 'hex')
      INTO n, digest
      FROM event_ledger;
    RAISE NOTICE 'RECOVERY-FINGERPRINT event_ledger count=% digest=%', n, digest;
END $$;

-- 50b 文件引用完整性：交付物须有 object_key 或内容哈希（否则恢复后引用不可访问）
DO $$
DECLARE bad int;
BEGIN
    SELECT count(*) INTO bad FROM deliverables
        WHERE coalesce(object_key,'') = '' AND coalesce(content_sha256,'') = '';
    IF bad > 0 THEN
        RAISE WARNING '注意 26.5b: 有 % 条交付物既无 object_key 也无 content_sha256（恢复后文件引用不可追溯）', bad;
    ELSE
        RAISE NOTICE 'PASS 26.5b: 交付物均具备文件引用/哈希';
    END IF;
END $$;

-- 50c 版本可追溯：每个 agent_version 都能解析到具体 model_config 与 prompt_version
DO $$
DECLARE dangling int;
BEGIN
    SELECT count(*) INTO dangling
      FROM agent_versions av
      LEFT JOIN model_configs   mc ON mc.id = av.model_config_id
      LEFT JOIN prompt_versions pv ON pv.id = av.prompt_version_id
     WHERE mc.id IS NULL OR pv.id IS NULL;
    IF dangling > 0 THEN
        RAISE EXCEPTION 'FAIL 26.5c: 有 % 个 agent_version 无法追溯 model/prompt 版本', dangling;
    END IF;
    RAISE NOTICE 'PASS 26.5c: Agent/Prompt/Model 版本链可追溯';
END $$;

-- 50d 每条 agent_run 记录了输入/输出哈希（恢复后可凭存档输出重放，见 §26.8）
DO $$
DECLARE primary_runs_missing_hash int;
BEGIN
    SELECT count(*) INTO primary_runs_missing_hash
      FROM agent_runs
     WHERE run_mode = 'primary' AND status = 'succeeded'
       AND (output_sha256 IS NULL);
    IF primary_runs_missing_hash > 0 THEN
        RAISE WARNING '注意 26.5d: 有 % 条成功 primary run 缺 output_sha256（重放/证据回放受损）', primary_runs_missing_hash;
    ELSE
        RAISE NOTICE 'PASS 26.5d: 成功 primary run 均记录 output_sha256';
    END IF;
END $$;
