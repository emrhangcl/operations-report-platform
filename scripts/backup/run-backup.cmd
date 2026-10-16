@echo off
rem Operasyon Portali gunluk sifreli yedegi. Windows Gorev Zamanlayici tarafindan calistirilir
rem (bkz. scripts\backup\schedule.mjs). Ciktilar OperationsPortal\backups\backup.log dosyasina eklenir.
setlocal
cd /d "%~dp0..\.."
set "BACKUP_LOG_DIR=%USERPROFILE%\OperationsPortal\backups"
if not exist "%BACKUP_LOG_DIR%" mkdir "%BACKUP_LOG_DIR%"
set "LOG=%BACKUP_LOG_DIR%\backup.log"
echo ==== %DATE% %TIME% >> "%LOG%"
node scripts\local\postgres.mjs start >> "%LOG%" 2>&1
call node_modules\.bin\tsx.cmd scripts\backup\backup.ts create >> "%LOG%" 2>&1
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo YEDEK BASARISIZ (kod %RESULT%) >> "%LOG%"
exit /b %RESULT%
