@echo off
chcp 65001 > nul
setlocal EnableExtensions

if /I "%~1"=="backend" goto run_backend
if /I "%~1"=="frontend" goto run_frontend

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\.venv"

echo ==========================================
echo     MOTION STORE - MODERN POS VERSION
echo ==========================================
echo.

if not exist "%BACKEND%\manage.py" goto missing_backend
if not exist "%FRONTEND%\package.json" goto missing_frontend

where python >nul 2>&1
if errorlevel 1 goto missing_python
where npm >nul 2>&1
if errorlevel 1 goto missing_node

if exist "%VENV%\Scripts\python.exe" goto venv_ready

echo Creating Python environment...
python -m venv "%VENV%"
if errorlevel 1 goto venv_error

:venv_ready
echo Installing backend requirements...
"%VENV%\Scripts\python.exe" -m pip install -r "%BACKEND%\requirements.txt" --quiet
if errorlevel 1 goto backend_install_error

echo Preparing SQLite database...
cd /d "%BACKEND%"
set USE_SQLITE=True
"%VENV%\Scripts\python.exe" manage.py migrate --noinput
if errorlevel 1 goto database_error

if exist "%FRONTEND%\node_modules" goto frontend_ready

echo Installing frontend packages...
cd /d "%FRONTEND%"
call npm ci
if errorlevel 1 goto frontend_install_error

:frontend_ready
echo Starting modern backend...
start "Motion Store Modern Backend" "%ComSpec%" /k ""%~f0" backend"
timeout /t 3 /nobreak > nul

echo Starting modern frontend...
start "Motion Store Modern Frontend" "%ComSpec%" /k ""%~f0" frontend"
timeout /t 5 /nobreak > nul
start "" "http://localhost:3001"
exit /b 0

:run_backend
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "VENV=%BACKEND%\.venv"
cd /d "%BACKEND%"
set USE_SQLITE=True
echo Backend running on http://localhost:8000
"%VENV%\Scripts\python.exe" manage.py runserver 0.0.0.0:8000
pause
exit /b 0

:run_frontend
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
cd /d "%FRONTEND%"
echo Frontend running on http://localhost:3001
call npm run dev -- --host 0.0.0.0 --port 3001
pause
exit /b 0

:missing_backend
echo ERROR: backend\manage.py was not found.
pause
exit /b 1
:missing_frontend
echo ERROR: frontend\package.json was not found.
pause
exit /b 1
:missing_python
echo ERROR: Python is not installed.
pause
exit /b 1
:missing_node
echo ERROR: Node.js/npm is not installed.
pause
exit /b 1
:venv_error
echo ERROR: Could not create Python environment.
pause
exit /b 1
:backend_install_error
echo ERROR: Could not install backend packages.
pause
exit /b 1
:database_error
echo ERROR: Database migration failed.
pause
exit /b 1
:frontend_install_error
echo ERROR: Could not install frontend packages.
pause
exit /b 1
