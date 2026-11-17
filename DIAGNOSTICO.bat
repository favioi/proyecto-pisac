@echo off
cd /d "%~dp0"
echo FECHA: %DATE% %TIME% > diagnostico.txt
echo CARPETA: %CD% >> diagnostico.txt
echo. >> diagnostico.txt
where node >> diagnostico.txt 2>&1
node -v >> diagnostico.txt 2>&1
node -p "process.arch" >> diagnostico.txt 2>&1
echo. >> diagnostico.txt
if exist package.json echo package.json: OK >> diagnostico.txt
if not exist package.json echo package.json: FALTA >> diagnostico.txt
if exist src\server.js echo src\server.js: OK >> diagnostico.txt
if not exist src\server.js echo src\server.js: FALTA >> diagnostico.txt
if exist public\index.html echo public: OK >> diagnostico.txt
if not exist public\index.html echo public: FALTA >> diagnostico.txt
if exist node_modules\better-sqlite3\prebuilds\win32-x64.node echo sqlite win32: OK >> diagnostico.txt
if not exist node_modules\better-sqlite3\prebuilds\win32-x64.node echo sqlite win32: FALTA >> diagnostico.txt
echo. >> diagnostico.txt
node -e "require('better-sqlite3'); console.log('better-sqlite3 carga: OK')" >> diagnostico.txt 2>&1
node -e "require('express'); console.log('express carga: OK')" >> diagnostico.txt 2>&1
node -e "require('dotenv'); console.log('dotenv carga: OK')" >> diagnostico.txt 2>&1
echo. >> diagnostico.txt
timeout /t 1 /nobreak >nul
node src\server.js >> diagnostico.txt 2>&1
type diagnostico.txt
echo.
echo   --------------------------------------------
echo   Copia el archivo diagnostico.txt y mandalo.
echo   --------------------------------------------
pause
