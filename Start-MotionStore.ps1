$py = "C:\Users\MotionDev\AppData\Local\Python\pythoncore-3.14-64\python.exe"
function Up($port) { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }
if (-not (Up 8000)) {
  $cmd = "& 'E:\MotionStore\NoQuickEdit.ps1'; `$host.UI.RawUI.WindowTitle='MOTION STORE BACKEND - DO NOT CLOSE'; Set-Location 'E:\MotionStore\motion-store\backend'; & '$py' manage.py runserver 0.0.0.0:8000"
  Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $cmd
  Write-Host "Starting backend..." -ForegroundColor Cyan
} else { Write-Host "Backend already running" -ForegroundColor Green }
if (-not (Up 3001)) {
  $cmd = "& 'E:\MotionStore\NoQuickEdit.ps1'; `$host.UI.RawUI.WindowTitle='MOTION STORE FRONTEND - DO NOT CLOSE'; Set-Location 'E:\MotionStore\motion-store\frontend'; npm run dev"
  Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $cmd
  Write-Host "Starting frontend..." -ForegroundColor Cyan
} else { Write-Host "Frontend already running" -ForegroundColor Green }
for ($i = 0; $i -lt 30; $i++) { if ((Up 8000) -and (Up 3001)) { break }; Start-Sleep -Seconds 2 }
if ((Up 8000) -and (Up 3001)) { Write-Host "MotionStore is ready" -ForegroundColor Green; Start-Process "http://localhost:3001" }
else { Write-Host "Something did not start - look at the two black windows" -ForegroundColor Red; Read-Host "Press Enter to close" }
