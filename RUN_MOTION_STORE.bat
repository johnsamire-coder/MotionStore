@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
title Motion Store - Smart Portable Launcher

echo ============================================================
echo   MOTION STORE - SMART MULTI-PC LAUNCHER
echo ============================================================
echo.

:: 1. تحديد اسم الجهاز الحالي
set "PC_NAME=%COMPUTERNAME%"
set "VENV_NAME=venv_%PC_NAME%"

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%backend"

:: 2. فحص هل الجهاز ده ليه بيئة خاصة على الفلاشة؟
if exist "%VENV_NAME%\Scripts\python.exe" (
    echo [+] Found existing environment for this PC: %VENV_NAME%
    echo [+] Waking up the engine...
) else (
    echo [!] New PC detected: %PC_NAME%
    echo [+] Preparing a one-time setup for this machine...
    
    :: إنشاء بيئة جديدة خاصة بهذا الجهاز
    python -m venv %VENV_NAME%
    
    echo [+] Installing necessary packages (one-time process)...
    call %VENV_NAME%\Scripts\activate.bat
    python -m pip install --upgrade pip --quiet
    pip install Django djangorestframework djangorestframework-simplejwt django-cors-headers python-dotenv django-filter drf-spectacular --quiet
)

:: 3. تفعيل البيئة وتجهيز البيانات
call %VENV_NAME%\Scripts\activate.bat
set USE_SQLITE=True
echo [+] Checking Database & Demo Data...
python manage.py migrate --noinput > nul
python manage.py shell -c "from apps.tenants.models import Tenant; from apps.tenants.context import set_current_tenant; from apps.users.models import User; t, _ = Tenant.objects.get_or_create(slug='motion-main', defaults={'name': 'Motion Store Main'}); set_current_tenant(t); u, _ = User.objects.get_or_create(username='admin'); u.set_password('123456'); u.is_staff=True; u.is_superuser=True; u.role='ADMIN'; u.tenant=t; u.save(); print('--- User admin is ready ---')"

echo.
echo ============================================================
echo   🚀 SYSTEM READY! STARTING SERVERS...
echo ============================================================

:: 4. تشغيل الباك إند في نافذة منفصلة
start "Backend Server" cmd /k "cd /d %SCRIPT_DIR%backend && call %VENV_NAME%\Scripts\activate.bat && set USE_SQLITE=True && python manage.py runserver 8000"

:: 5. تشغيل الفرونت إند في نافذة منفصلة
timeout /t 2 > nul
start "Frontend UI" cmd /k "cd /d %SCRIPT_DIR%frontend && npm run dev"

:: 6. فتح المتصفح
timeout /t 5 > nul
explorer "http://localhost:3001"

echo.
echo [DONE] Motion Store is now running on this %PC_NAME%.
echo You can minimize this window.
