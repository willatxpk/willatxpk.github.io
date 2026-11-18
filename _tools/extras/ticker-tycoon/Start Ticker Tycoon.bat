@echo off
rem Runs Ticker Tycoon with live news and real stock quotes. Close this window to stop.
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8793"
py -3 server.py
if errorlevel 1 python server.py
pause
