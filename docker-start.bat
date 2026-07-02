@echo off
echo ====================================
echo    Em Tu - Docker Startup
echo ====================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check if .env exists
if not exist .env (
    echo [WARNING] .env file not found!
    echo Creating .env from template...
    copy .env.docker.example .env
    echo.
    echo [ACTION REQUIRED] Please edit .env file and add your API keys
    echo Then run this script again.
    notepad .env
    pause
    exit /b 1
)

echo [OK] .env file found
echo.

REM Stop existing containers
echo Stopping existing containers...
docker-compose down
echo.

REM Build and start
echo Building and starting containers...
docker-compose up -d --build
echo.

REM Wait for services
echo Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check health
echo.
echo Checking service health...
echo.

curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend:  http://localhost:8000
) else (
    echo [WAIT] Backend is starting...
)

curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend: http://localhost:5173
) else (
    echo [WAIT] Frontend is starting...
)

echo.
echo ====================================
echo Services are starting!
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo To view logs: docker-compose logs -f
echo To stop:      docker-compose down
echo ====================================
echo.

REM Open browser
timeout /t 5 /nobreak >nul
start http://localhost:5173

pause
