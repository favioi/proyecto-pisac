@echo off
cd /d "%~dp0"
title PISAC
echo.
echo   ============================================
echo     PISAC - iniciando el servidor
echo   ============================================
echo.
echo   Si esta ventana se cierra, ejecuta DIAGNOSTICO.bat
echo.
start "" http://localhost:3000
node src\server.js
echo.
echo   --------------------------------------------
echo   El servidor se detuvo. Mensaje de arriba.
echo   --------------------------------------------
pause
