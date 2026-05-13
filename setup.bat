@echo off
REM Setup do dashboard_v2 — instala dependencias Python necessarias
REM Rode UMA VEZ antes do primeiro uso

echo ================================================
echo  Dashboard RDP v2 - Instalacao de dependencias
echo ================================================
echo.

REM Verifica se Python esta no PATH
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado no PATH.
    echo Instale Python 3.10+ em https://python.org
    pause
    exit /b 1
)

echo Python encontrado. Instalando bibliotecas...
echo.

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo [AVISO] pip falhou - tentando com --break-system-packages
    python -m pip install -r requirements.txt --break-system-packages
)

echo.
echo ================================================
echo  Validando instalacao...
echo ================================================
python -c "import pdfplumber, docx2txt, pypdf, openpyxl; print('Todas as bibliotecas OK')"

if errorlevel 1 (
    echo [ERRO] Alguma biblioteca falhou. Verifique os erros acima.
    pause
    exit /b 1
)

echo.
echo ================================================
echo  Instalacao concluida com sucesso!
echo ================================================
echo.
echo Proximo passo: rode "python scripts\process_rdps.py"
echo.
pause
