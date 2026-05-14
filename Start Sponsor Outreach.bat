@echo off
setlocal
set "APP=%~dp0sponsor-outreach\index.html"

if not exist "%APP%" (
  echo Could not find the sponsor outreach app:
  echo "%APP%"
  echo.
  pause
  exit /b 1
)

start "" "%APP%"
exit /b 0
