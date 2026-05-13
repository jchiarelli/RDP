# Setup do dashboard_v2 - PowerShell
# Rode UMA VEZ antes do primeiro uso: .\setup.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Dashboard RDP v2 - Instalacao de dependencias" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verifica Python
try {
    $pyVersion = python --version 2>&1
    Write-Host "Python encontrado: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Python nao encontrado no PATH." -ForegroundColor Red
    Write-Host "Instale Python 3.10+ em https://python.org" -ForegroundColor Yellow
    exit 1
}

Write-Host "Instalando bibliotecas..." -ForegroundColor Cyan
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "[AVISO] pip falhou - tentando --break-system-packages" -ForegroundColor Yellow
    python -m pip install -r requirements.txt --break-system-packages
}

Write-Host ""
Write-Host "Validando instalacao..." -ForegroundColor Cyan
python -c "import pdfplumber, docx2txt, pypdf, openpyxl; print('Todas as bibliotecas OK')"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  Instalacao concluida com sucesso!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximo passo: rode 'python scripts\process_rdps.py'" -ForegroundColor Cyan
} else {
    Write-Host "[ERRO] Alguma biblioteca falhou." -ForegroundColor Red
    exit 1
}
