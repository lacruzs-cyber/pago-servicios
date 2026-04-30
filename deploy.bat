@echo off
cd /d "%~dp0"
echo.
echo === Pago de Servicios — Deploy ===
echo.

git add -A
if errorlevel 1 goto error

set FECHA=%date:~6,4%-%date:~3,2%-%date:~0,2% %time:~0,5%
git commit -m "deploy: %FECHA%"
if errorlevel 1 (
  echo No hay cambios para commitear.
  goto push
)

:push
echo.
echo Subiendo a GitHub...
git push origin main
if errorlevel 1 goto error

echo.
echo Listo. Render va a redeplegar automaticamente en ~3 min.
echo URL: https://pago-servicios.onrender.com
echo.
pause
exit /b 0

:error
echo.
echo ERROR - algo salio mal. Revisa el mensaje de arriba.
echo.
pause
exit /b 1
