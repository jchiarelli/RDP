# Script para iniciar o servidor do dashboard
# Execute este arquivo com: powershell -ExecutionPolicy Bypass -File run_server.ps1

$dashboardPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dashboardPath

Write-Host "Iniciando servidor do dashboard RDP..."
Write-Host "Endereço: http://localhost:8765/dashboard.html"
Write-Host "Pressione Ctrl+C para parar o servidor`n"

# Inicia o servidor Python
python scripts/serve.py --port 8765 --open
