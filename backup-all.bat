@echo off
REM ============================================================
REM backup-all.bat - Purit full backup (DB rows + Storage files)
REM   Run by double-click or Windows Task Scheduler (daily).
REM   Output dir = BACKUP_DIR in .env.local (else project backups\).
REM   ASCII-only on purpose: Korean text breaks under cmd CP949.
REM ============================================================
cd /d "%~dp0"
echo === Purit backup start %date% %time% ===
echo.
echo [1/2] DB rows...
call node scripts/backup-db.mjs
echo.
echo [2/2] Storage files...
call node scripts/backup-storage.mjs
echo.
echo === Purit backup done %date% %time% ===
