@echo off
rem RupeePlate: double-click this file. It sets up Python once, starts the app and opens the browser.
cd /d "%~dp0backend"
if not exist .venv ( python -m venv .venv )
call .venv\Scripts\activate
pip install -q -r requirements.txt
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:8000"
python -m uvicorn main:app --port 8000
pause
