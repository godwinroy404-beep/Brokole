# ============================================================================
# Writes .env.local for BOTH apps in one go.
#
# Run from G:\gradent\Bro-Ko-Le in PowerShell:
#     .\scripts\set-supabase-env.ps1
#
# It prompts for the two values, validates them, and writes the files with the
# correct names and encoding. Your keys are typed into your own terminal and
# never leave this machine.
# ============================================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "Brokole - Supabase connection setup" -ForegroundColor Cyan
Write-Host "Get both values from your project's Settings -> API Keys page." -ForegroundColor DarkGray
Write-Host ""

# ── Project URL ─────────────────────────────────────────────────────────────
do {
  $url = (Read-Host "Project URL (https://xxxx.supabase.co)").Trim().TrimEnd('/')
  $urlOk = $url -match '^https://[a-z0-9-]+\.supabase\.(co|in)$'

  if ($urlOk -and $url -like '*placeholder*') {
    Write-Host "  That's the placeholder value, not your project. Copy the real URL from the dashboard." -ForegroundColor Yellow
    $urlOk = $false
  }
  elseif (-not $urlOk) {
    Write-Host "  That doesn't look right. It should be exactly like https://abcdefgh.supabase.co" -ForegroundColor Yellow
  }
} until ($urlOk)

# ── Key ─────────────────────────────────────────────────────────────────────
do {
  $key = (Read-Host "Publishable key (sb_publishable_... or the legacy eyJ... anon key)").Trim()
  $keyOk = $true

  if ($key -like 'sb_secret_*' -or $key -like '*service_role*') {
    Write-Host "  STOP - that is a SECRET key." -ForegroundColor Red
    Write-Host "  It bypasses Row Level Security and would be compiled into the JavaScript" -ForegroundColor Red
    Write-Host "  bundle every visitor downloads. Use the publishable key instead." -ForegroundColor Red
    $keyOk = $false
  }
  elseif ($key.Length -lt 20) {
    Write-Host "  That looks too short - paste the whole key." -ForegroundColor Yellow
    $keyOk = $false
  }
  elseif (-not ($key -like 'sb_publishable_*' -or $key -like 'eyJ*')) {
    Write-Host "  Expected it to start with sb_publishable_ or eyJ. Check you copied the right one." -ForegroundColor Yellow
    $keyOk = $false
  }
} until ($keyOk)

# Legacy anon keys keep the old variable name; publishable keys use the new one.
# Both are read by the apps, so either is fine.
$keyName = if ($key -like 'eyJ*') { 'VITE_SUPABASE_ANON_KEY' } else { 'VITE_SUPABASE_PUBLISHABLE_KEY' }

$content = @"
VITE_SUPABASE_URL=$url
$keyName=$key
"@

# UTF8 without BOM - a BOM on the first line breaks the first variable name.
$enc = New-Object System.Text.UTF8Encoding($false)

$targets = @(
  (Join-Path $root '.env.local'),
  (Join-Path $root 'apps\admin\.env.local')
)

foreach ($t in $targets) {
  $dir = Split-Path -Parent $t
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($t, $content, $enc)
  Write-Host "  wrote $t" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Both apps now point at $url" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: stop and restart both dev servers." -ForegroundColor Yellow
Write-Host "Vite reads .env.local only at startup, so a running server won't pick this up."
Write-Host ""
Write-Host "  Storefront:  npm run dev              (http://localhost:5174)"
Write-Host "  Admin:       cd apps\admin; npm run dev   (http://localhost:5175)"
Write-Host ""
