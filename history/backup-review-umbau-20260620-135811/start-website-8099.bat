@echo off
cd /d "%~dp0"
echo Website startet auf http://localhost:8099/
echo Dieses Fenster offen lassen, solange du die Website anschaust.
python -m http.server 8099 --bind 127.0.0.1
pause
