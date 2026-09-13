@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte Node.js installieren und erneut starten.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo npm wurde nicht gefunden. Bitte Node.js mit npm installieren und erneut starten.
  pause
  exit /b 1
)
echo Sichere Website-Vorschau startet auf http://localhost:8099/
echo Nur der lokale _preview-Ordner wird ausgeliefert. Dieses Fenster offen lassen.
call npm run dev:preview -- --port 8099
if errorlevel 1 (
  echo Die sichere Vorschau konnte nicht gestartet werden oder wurde mit einem Fehler beendet.
  pause
  exit /b 1
)
pause
