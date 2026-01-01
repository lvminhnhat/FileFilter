@echo off
setlocal enabledelayedexpansion

echo ========================================
echo FileFilter - Build Release Script
echo ========================================

set VERSION=1.0.0
set PROJECT_DIR=%~dp0..
cd /d "%PROJECT_DIR%"

echo.
echo [1/5] Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist release rmdir /s /q release
mkdir release

echo.
echo [2/5] Checking Neutralino CLI...
where neu >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing Neutralino CLI...
    npm install -g @neutralinojs/neu
)
call neu update

echo.
echo [3/5] Building application...
call neu build --release

echo.
echo [4/5] Creating release packages...

if exist dist\FileFilter (
    cd dist
    
    REM Windows Package
    if exist FileFilter\FileFilter-win_x64.exe (
        echo Creating Windows package...
        mkdir FileFilter-Windows
        xcopy /E /I /Y FileFilter\* FileFilter-Windows\
        if exist FileFilter-Windows\FileFilter-win_x64.exe (
            move /Y FileFilter-Windows\FileFilter-win_x64.exe FileFilter-Windows\FileFilter.exe
        )
        del /Q FileFilter-Windows\FileFilter-linux_* 2>nul
        del /Q FileFilter-Windows\FileFilter-mac_* 2>nul
        
        REM Create ZIP using PowerShell
        powershell -Command "Compress-Archive -Path 'FileFilter-Windows\*' -DestinationPath '..\release\FileFilter-%VERSION%-Windows-x64.zip' -Force"
        rmdir /s /q FileFilter-Windows
    )
    
    cd ..
)

echo.
echo [5/5] Release packages created!
echo.
echo Output files in release/:
dir release

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Run Inno Setup with installer\inno-setup\setup.iss to create installer
echo 2. Upload release packages to GitHub Releases

pause
