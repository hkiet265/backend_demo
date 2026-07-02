@echo off
echo ====================================
echo    Em Tu - Docker Shutdown
echo ====================================
echo.

echo Stopping all containers...
docker-compose down

echo.
echo ====================================
echo All services stopped!
echo ====================================
pause
