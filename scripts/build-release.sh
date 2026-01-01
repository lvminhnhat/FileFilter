#!/bin/bash

set -e

echo "========================================"
echo "FileFilter - Build Release Script"
echo "========================================"

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "[1/5] Cleaning previous builds..."
rm -rf dist/
rm -rf release/
mkdir -p release

echo ""
echo "[2/5] Installing/Updating Neutralino..."
if ! command -v neu &> /dev/null; then
    echo "Installing Neutralino CLI..."
    npm install -g @neutralinojs/neu
fi
neu update

echo ""
echo "[3/5] Building application..."
neu build --release

echo ""
echo "[4/5] Creating release packages..."

if [ -d "dist/FileFilter" ]; then
    cd dist
    
    # Windows ZIP
    if [ -f "FileFilter/FileFilter-win_x64.exe" ]; then
        echo "Creating Windows package..."
        mkdir -p FileFilter-Windows
        cp -r FileFilter/* FileFilter-Windows/
        mv FileFilter-Windows/FileFilter-win_x64.exe FileFilter-Windows/FileFilter.exe 2>/dev/null || true
        rm -f FileFilter-Windows/FileFilter-linux_* FileFilter-Windows/FileFilter-mac_* 2>/dev/null || true
        zip -r "../release/FileFilter-${VERSION}-Windows-x64.zip" FileFilter-Windows
        rm -rf FileFilter-Windows
    fi
    
    # Linux ZIP
    if [ -f "FileFilter/FileFilter-linux_x64" ]; then
        echo "Creating Linux package..."
        mkdir -p FileFilter-Linux
        cp -r FileFilter/* FileFilter-Linux/
        mv FileFilter-Linux/FileFilter-linux_x64 FileFilter-Linux/FileFilter 2>/dev/null || true
        chmod +x FileFilter-Linux/FileFilter
        rm -f FileFilter-Linux/FileFilter-win_* FileFilter-Linux/FileFilter-mac_* 2>/dev/null || true
        tar -czvf "../release/FileFilter-${VERSION}-Linux-x64.tar.gz" FileFilter-Linux
        rm -rf FileFilter-Linux
    fi
    
    # macOS ZIP
    if [ -f "FileFilter/FileFilter-mac_x64" ]; then
        echo "Creating macOS package..."
        mkdir -p FileFilter-macOS
        cp -r FileFilter/* FileFilter-macOS/
        mv FileFilter-macOS/FileFilter-mac_x64 FileFilter-macOS/FileFilter 2>/dev/null || true
        chmod +x FileFilter-macOS/FileFilter
        rm -f FileFilter-macOS/FileFilter-win_* FileFilter-macOS/FileFilter-linux_* 2>/dev/null || true
        zip -r "../release/FileFilter-${VERSION}-macOS-x64.zip" FileFilter-macOS
        rm -rf FileFilter-macOS
    fi
    
    cd ..
fi

echo ""
echo "[5/5] Release packages created!"
echo ""
echo "Output files in release/:"
ls -la release/

echo ""
echo "========================================"
echo "Build completed successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. For Windows installer: Use NSIS or Inno Setup with scripts in installer/"
echo "2. Upload release packages to GitHub Releases"
