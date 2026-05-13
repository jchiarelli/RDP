@echo off
REM Inicia servidor local do dashboard RDP e abre o navegador
cd /d "%~dp0"
python scripts\serve.py --open
pause
