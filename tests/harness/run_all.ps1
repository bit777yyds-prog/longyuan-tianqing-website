# ============================================================
# 验收测试运行器（PowerShell 版）— 审计者维护
# 与 run_all.sh 等价；需要 docker。用法：powershell -File tests\harness\run_all.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Ctr  = "longyuan-acc-test-$PID"
$Db   = "longyuan_test"
$Img  = "postgres:16-alpine"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "需要 docker（审计机若无，请在 CI 运行）"; exit 3
}

function Cleanup { docker rm -f $Ctr 2>$null | Out-Null }
try {
    Write-Host ">> 启动一次性 Postgres 容器 $Ctr"
    docker run -d --name $Ctr -e POSTGRES_PASSWORD=acc-test-only -e POSTGRES_DB=$Db $Img | Out-Null
    for ($i=0; $i -lt 30; $i++) {
        docker exec $Ctr pg_isready -U postgres -d $Db 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 1
    }

    function Psql([string]$file, [switch]$Single) {
        $flag = @(); if ($Single) { $flag = @('--single-transaction') }
        Get-Content -Raw $file | docker exec -i $Ctr psql -v ON_ERROR_STOP=1 @flag -U postgres -d $Db
        return $LASTEXITCODE
    }

    Write-Host ">> 加载被测 Schema"
    Psql "$Root\db\init\001_agent_native_schema.sql" | Out-Null
    Write-Host ">> 加载测试角色 fixture"
    Psql "$Root\tests\fixtures\000_test_roles.sql" | Out-Null

    $fails = 0
    Get-ChildItem "$Root\tests\acceptance\*.sql" | Sort-Object Name | ForEach-Object {
        Write-Host "------------------------------------------------------------"
        Write-Host ">> RUN $($_.Name)"
        Psql "$Root\tests\fixtures\010_seed.sql" | Out-Null
        $code = Psql $_.FullName -Single
        if ($code -eq 0) { Write-Host "   => 组内断言全部 PASS" }
        else { Write-Host "   => 组内存在 FAIL"; $fails++ }
        docker exec -i $Ctr psql -q -U postgres -d $Db -c `
          "TRUNCATE approvals, candidate_events, agent_runs, agent_jobs, state_projections, event_ledger, agent_trigger_rules, deliverables, tasks, agent_versions, agent_definitions, prompt_versions, model_configs, projects, actors CASCADE;" 2>$null | Out-Null
    }

    Write-Host "============================================================"
    if ($fails -eq 0) { Write-Host "验收运行器：全部测试文件 PASS"; exit 0 }
    else { Write-Host "验收运行器：$fails 个测试文件存在 FAIL"; exit 1 }
}
finally { Cleanup }
