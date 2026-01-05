# Start Minitab Application
# This script starts both backend and frontend

Write-Host "Starting Minitab Application..." -ForegroundColor Cyan

# Start backend in new window
Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$PSScriptRoot\run_backend.ps1`""

# Wait a bit
Start-Sleep -Seconds 3

# Start frontend in new window
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$PSScriptRoot\run_frontend.ps1`""

Write-Host ""
Write-Host "Application started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan



