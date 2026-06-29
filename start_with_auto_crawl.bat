@echo off
echo ========================================
echo Starting Backend with Auto-Crawling
echo ========================================
echo.
echo Auto-crawl will run every 15 minutes
echo Monitor logs to see crawling activity
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d d:\workspace\backend_demo
call venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pause
