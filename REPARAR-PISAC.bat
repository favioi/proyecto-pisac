@echo off
setlocal
title PISAC - Reparar instalacion
cd /d "%~dp0"

echo.
echo  ====================================================
echo    PISAC - Reparar instalacion
echo  ====================================================
echo.
echo  Esto borra la carpeta node_modules y vuelve a instalar
echo  todos los componentes. NO borra tus datos: la base de
echo  datos esta en la carpeta  data  y no se toca.
echo.
echo  IMPORTANTE: se cerraran las ventanas de Node.js abiertas.
echo.
pause

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [ERROR] No se encontro Node.js.
  echo  Instalalo desde https://nodejs.org y vuelve a intentar.
  echo.
  pause
  exit /b 1
)


REM --- Version de Node.js (PISAC necesita 20 o superior) ---
set "NODE_MAYOR=0"
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODE_MAYOR=%%v"
if %NODE_MAYOR% LSS 20 (
  echo  [ERROR] Tu version de Node.js es demasiado antigua.
  echo.
  node -v
  echo.
  echo  PISAC necesita Node.js 20 o superior ^(recomendado 22 LTS^).
  echo.
  echo  1. Entra a  https://nodejs.org
  echo  2. Descarga la version LTS para Windows ^(instalador .msi^)
  echo  3. Instalala y CIERRA esta ventana
  echo  4. Vuelve a abrir este archivo
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo.
  echo  [ERROR] Falta package.json en esta carpeta.
  echo  Extrae de nuevo el ZIP completo y abre este archivo desde
  echo  la carpeta  pisac.
  echo.
  pause
  exit /b 1
)

echo.
echo  Cerrando servidores PISAC abiertos...
taskkill /f /im node.exe >nul 2>nul

echo  Borrando componentes anteriores...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "node_modules" (
  echo.
  echo  [ERROR] No se pudo borrar node_modules.
  echo  Cierra todas las ventanas negras de PISAC y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

if exist "package-lock.json" del /q "package-lock.json"

echo  Reinstalando componentes (puede tardar un par de minutos)...
echo.
call npm cache verify >nul 2>nul
call npm install --no-audit --no-fund

if errorlevel 1 (
  echo.
  echo  [ERROR] Fallo la instalacion.
  echo.
  echo  Revisa tu conexion a internet y vuelve a ejecutar este archivo.
  echo  Si el problema sigue, prueba en otra red (por ejemplo, datos del celular).
  echo.
  pause
  exit /b 1
)

echo.
echo  Comprobando que todo este listo...
echo.
call npm run verificar

echo.
echo  ------------------------------------------------------
echo   Reparacion terminada. Si todo esta en verde o ambar,
echo   cierra esta ventana y abre INICIAR-PISAC.bat
echo  ------------------------------------------------------
echo.
pause
exit /b 0
