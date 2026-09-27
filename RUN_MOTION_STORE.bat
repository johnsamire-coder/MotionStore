@echo off
chcp 65001 > nul
setlocal EnableExtensions
title Motion Store - Smart Portable Launcher

echo ============================================================
echo   MOTION STORE - SMART MULTI-PC LAUNCHER
echo ============================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"
set "PC_NAME=%COMPUTERNAME%"
set "VENV_NAME=venv_%PC_NAME%"

if not exist "%BACKEND_DIR%\manage.py" goto missing_backend
if not exist "%FRONTEND_DIR%\package.json" goto missing_frontend

cd /d "%BACKEND_DIR%"
if exist "%VENV_NAME%\Scripts\python.exe" goto env_ready

echo [!] New PC detected: %PC_NAME%
echo [+] Preparing a one-time setup for this machine...
python -m venv "%VENV_NAME%"
if errorlevel 1 goto python_error
call "%VENV_NAME%\Scripts\activate.bat"
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
if errorlevel 1 goto install_error

goto env_ready

:env_ready
call "%VENV_NAME%\Scripts\activate.bat"
set "USE_SQLITE=True"
echo [+] Checking database...
python manage.py migrate --noinput
if errorlevel 1 goto migrate_error
python manage.py shell -c "from apps.tenants.models import Tenant; from apps.tenants.context import set_current_tenant; from apps.users.models import User; t, _ = Tenant.objects.get_or_create(slug='motion-main', defaults={'name': 'Motion Store Main'}); set_current_tenant(t); u, _ = User.objects.get_or_create(username='admin'); u.set_password('123456'); u.is_staff=True; u.is_superuser=True; u.role='ADMIN'; u.tenant=t; u.save(); print('--- User admin is ready ---')"
if errorlevel 1 goto seed_error

echo.
echo ============================================================
echo   SYSTEM READY! STARTING SERVERS...
echo ============================================================
echo.

start "Backend Server" cmd /k "cd /d "%BACKEND_DIR%" && call "%BACKEND_DIR%\%VENV_NAME%\Scripts\activate.bat" && set USE_SQLITE=True && python manage.py runserver 0.0.0.0:8000"
timeout /t 2 /nobreak > nul
start "Frontend UI" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev -- --host 0.0.0.0 --port 3001"
timeout /t 5 /nobreak > nul
start "" "http://localhost:3001"

echo.
echo [DONE] Motion Store is now running on this PC.
exit /b 0

:missing_backend
echo [ERROR] backend\manage.py was not found.
goto failed
:missing_frontend
echo [ERROR] frontend\package.json was not found.
goto failed
:python_error
echo [ERROR] Python is not installed or not available as 'python'.
goto failed
:install_error
echo [ERROR] Could not install backend requirements.
goto failed
:migrate_error
echo [ERROR] Database migration failed.
goto failed
:seed_error
echo [ERROR] Initial user setup failed.
goto failed
:failed
pause
exit /b 1
