$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$museumNode = Get-Command node -ErrorAction SilentlyContinue
if ($museumNode) { $museumNodePath = $museumNode.Source }
else {
    $portableNode = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.tools') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'node-*-win-x64' } | Select-Object -First 1
    if (-not $portableNode) { throw 'Install Node.js 22 or newer from https://nodejs.org, then run this script again.' }
    $museumNodePath = Join-Path $portableNode.FullName 'node.exe'
}
$env:Path = (Split-Path -Parent $museumNodePath) + ';' + $env:Path
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist/index.html'))) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' } }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
$museumAddress = 'http://127.0.0.1:4173'
$alreadyRunning = $false
try { $response = Invoke-WebRequest -UseBasicParsing -Uri $museumAddress -TimeoutSec 2; $alreadyRunning = $response.Content -like '*QAZAQSTAN*' } catch {}
if (-not $alreadyRunning) {
    $logDirectory = Join-Path $PSScriptRoot '.tools'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    Start-Process -FilePath $museumNodePath -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'museum-server.log') -RedirectStandardError (Join-Path $logDirectory 'museum-server-error.log')
}
Start-Process $museumAddress
Write-Host "Museum opened: $museumAddress"
