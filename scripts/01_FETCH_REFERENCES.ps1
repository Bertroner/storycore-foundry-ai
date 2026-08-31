$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Refs = Join-Path $Root "_references"

New-Item -ItemType Directory -Force -Path $Refs | Out-Null

function Clone-Pinned {
    param(
        [string]$Name,
        [string]$Repo,
        [string]$Ref
    )

    $Dest = Join-Path $Refs $Name
    if (Test-Path $Dest) {
        Write-Host "[SKIP] $Name already exists: $Dest" -ForegroundColor Yellow
        return
    }

    Write-Host "[CLONE] $Name @ $Ref" -ForegroundColor Cyan
    git clone --depth 1 --branch $Ref $Repo $Dest
    if ($LASTEXITCODE -ne 0) {
        throw "git clone failed: $Name"
    }
}

Clone-Pinned "foundry-api-bridge" "https://github.com/alexivenkov/foundry-api-bridge-module.git" "v8.11.2"
Clone-Pinned "foundry-ai-tool" "https://github.com/Gnuminator/Foundry-VTT-MCP-Ai-Tool.git" "v0.18.0"
Clone-Pinned "foundry-ai" "https://github.com/derekhearst/FoundryAI.git" "1.3.0"
Clone-Pinned "mookAI-12" "https://github.com/CircusGM/mookAI-12.git" "1.0.5"
Clone-Pinned "lib-find-the-path-12" "https://github.com/CircusGM/lib-find-the-path-12.git" "2.0.5"
Clone-Pinned "pf2e-ai-combat-assistant" "https://github.com/AI-DM-Foundry/AI-Combat-Assistant-Pf2e.git" "1.07"

Write-Host ""
Write-Host "Reference sources are ready under:" -ForegroundColor Green
Write-Host $Refs -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: _references is gitignored. Do not commit donor repositories." -ForegroundColor Yellow
