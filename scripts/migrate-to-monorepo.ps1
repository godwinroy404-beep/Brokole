# ============================================================================
# Promotes the existing single-app repo into the monorepo layout.
#
# Run from G:\gradent\Bro-Ko-Le in PowerShell:
#     .\scripts\migrate-to-monorepo.ps1
#
# It only MOVES files that are already yours. It deletes nothing except
# node_modules and dist, which are rebuilt by the install afterwards.
# Nothing here touches the database.
# ============================================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Promoting $root to a monorepo..." -ForegroundColor Cyan

if (Test-Path 'apps\web\src') {
  Write-Host "apps\web already exists - nothing to do." -ForegroundColor Yellow
  exit 0
}

New-Item -ItemType Directory -Force -Path 'apps\web' | Out-Null

# stale build output and installed packages - both regenerated below
foreach ($stale in @('node_modules', 'dist', '.tanstack')) {
  if (Test-Path $stale) {
    Write-Host "  removing $stale"
    Remove-Item -Recurse -Force $stale
  }
}

# the customer app's own files move under apps\web
$moves = @(
  'src', 'public', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts'
)
foreach ($item in $moves) {
  if (Test-Path $item) {
    Write-Host "  moving $item -> apps\web\"
    Move-Item -Path $item -Destination 'apps\web\' -Force
  }
}

# the customer app becomes a named workspace package
$pkgPath = 'apps\web\package.json'
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkg.name = '@brokole/web'
$pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath -Encoding UTF8

# the workspace root package.json takes the place of the old one
if (Test-Path 'package.root.json') {
  Move-Item -Path 'package.root.json' -Destination 'package.json' -Force
}

Write-Host ""
Write-Host "Done. Layout is now:" -ForegroundColor Green
Write-Host "  apps\web      your storefront"
Write-Host "  apps\admin    the operations console"
Write-Host "  packages\domain  shared rules"
Write-Host "  supabase\     migrations + seed"
Write-Host ""
Write-Host "Next:  pnpm install" -ForegroundColor Cyan
