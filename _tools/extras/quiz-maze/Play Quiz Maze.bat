@echo off
rem Serves Quiz Maze on http://localhost:8791 so a local Ollama model can write Adventure stories. Close this window to stop.
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8791"
py -3 -m http.server 8791 --bind 127.0.0.1
if errorlevel 1 python -m http.server 8791 --bind 127.0.0.1
pause
