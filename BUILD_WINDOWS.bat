@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 pause & exit /b 1
call npm run dist:win
if errorlevel 1 pause & exit /b 1
echo.
echo Fertige Dateien liegen im Ordner dist. / Finished files are in the dist folder.
pause
