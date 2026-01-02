# Run Frontend Server
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

Write-Host "Starting React Frontend Server..." -ForegroundColor Cyan

# Get the script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $scriptPath "frontend"
Set-Location $frontendPath

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found! Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check if package.json exists
$packageJsonPath = Join-Path $frontendPath "package.json"
if (-not (Test-Path $packageJsonPath)) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Please ensure you're in the frontend directory." -ForegroundColor Yellow
    exit 1
}

# Install dependencies if needed
$nodeModulesPath = Join-Path $frontendPath "node_modules"
if (-not $SkipInstall -and -not (Test-Path $nodeModulesPath)) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
} elseif (Test-Path $nodeModulesPath) {
    Write-Host "Dependencies already installed" -ForegroundColor Green
}

# Start development server
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  React Frontend Server Starting" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
