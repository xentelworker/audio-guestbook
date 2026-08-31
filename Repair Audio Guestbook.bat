@echo off
title Audio Guestbook Repair Tool
cd /d "%~dp0"

echo.
echo ========================================
echo   AUDIO GUESTBOOK REPAIR TOOL
echo ========================================
echo.

if not exist ".env.local" (
    echo ERROR: .env.local was not found.
    echo.
    pause
    exit /b 1
)

if not exist ".env.repair" (
    echo ERROR: .env.repair was not found.
    echo.
    echo Create .env.repair containing:
    echo REPAIR_EMAIL=your-email
    echo REPAIR_PASSWORD=your-password
    echo.
    pause
    exit /b 1
)

if not exist "tools\repair-audio.mjs" (
    echo ERROR: tools\repair-audio.mjs was not found.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\ffmpeg-static" (
    echo.
    echo FFmpeg package is missing.
    echo Installing ffmpeg-static...
    echo.

    call npm install --save-dev ffmpeg-static

    if errorlevel 1 (
        echo.
        echo ERROR: ffmpeg-static installation failed.
        pause
        exit /b 1
    )
)

echo Starting repair tool...
echo.

node --env-file=.env.local --env-file=.env.repair tools\repair-audio.mjs

echo.
echo ========================================
echo Repair tool has finished.
echo ========================================
echo.

pause