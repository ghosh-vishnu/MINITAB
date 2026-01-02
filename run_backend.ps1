# Run Backend Server
param(
    [switch]$NoMigrations
)

$ErrorActionPreference = "Stop"

Write-Host "Starting Django Backend Server..." -ForegroundColor Cyan

# Get the script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"
Set-Location $backendPath

# Check if .env exists
$envPath = Join-Path $backendPath ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please run setup_and_run.ps1 first or create .env file manually." -ForegroundColor Yellow
    exit 1
}

# Activate virtual environment
$venvPath = Join-Path $backendPath "venv"
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"

if (-not (Test-Path $activateScript)) {
    Write-Host "Virtual environment not found. Creating..." -ForegroundColor Yellow
    python -m venv venv
    if (-not (Test-Path $activateScript)) {
        Write-Host "ERROR: Failed to create virtual environment!" -ForegroundColor Red
        exit 1
    }
}

# Activate venv
& $activateScript

# Install dependencies if needed
if (-not (Test-Path (Join-Path $venvPath "Lib\site-packages\django"))) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt --quiet
    pip install setuptools --quiet
}

# Run migrations
if (-not $NoMigrations) {
    Write-Host "Running migrations..." -ForegroundColor Yellow
    python manage.py migrate
}

# Start server
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Django Backend Server Starting" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Admin Panel: http://localhost:8000/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python manage.py runserver
