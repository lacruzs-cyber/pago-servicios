@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\node_modules" (
  echo Instalando dependencias por primera vez, puede tardar unos minutos...
  call npm run install:all
  if errorlevel 1 (
    echo.
    echo Hubo un error instalando dependencias. Revisa que tengas Node.js instalado.
    pause
    exit /b 1
  )
)

if not exist "app\dist" (
  echo Compilando la aplicacion...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Hubo un error compilando la aplicacion.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Pago de Servicios - http://localhost:4000
echo   Para apagar la app, cerra esta ventana.
echo ============================================
echo.

powershell -Command "Start-Sleep -Seconds 2; Start-Process http://localhost:4000" >nul 2>&1
call npm start

pause
