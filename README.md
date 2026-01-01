# FileFilter

Lightweight desktop application for scanning, filtering, converting, and compressing images.

![FileFilter](resources/icons/appIcon.png)

## Features

### Image Filtering
- **Scan folders** - Select any folder to scan for images
- **Include subfolders** - Option to scan subdirectories recursively
- **Filter by extension** - JPG, PNG, GIF, WebP, BMP, SVG, ICO, TIFF
- **Filter by file size** - Set min/max file size in KB
- **Filter by dimensions** - Set min/max width and height in pixels
- **Preview thumbnails** - View image thumbnails with file info
- **Copy/Move images** - Copy or move selected images to a new folder
- **Export results** - Export file paths to TXT or copy to clipboard

### Image Conversion (NEW)
- **Convert formats** - PNG, JPG, WebP, GIF, BMP
- **Batch conversion** - Convert multiple images at once
- **Quality control** - Adjust output quality (1-100%)
- **Flexible output** - Save to same folder or custom location
- **Preserve originals** - Original files are never modified

### Image Compression (NEW)
- **Quality-based compression** - Compress by percentage (1-100%)
- **Size-based compression** - Compress to target file size (KB)
- **Smart algorithms** - Binary search for optimal compression
- **Preset options** - Quick presets (High/Medium/Low quality)
- **Batch processing** - Compress multiple images at once
- **Size comparison** - View before/after file sizes

## Screenshots

| Filter Tab | Convert Tab | Compress Tab |
|------------|-------------|--------------|
| Scan and filter images | Convert between formats | Compress with quality control |

## Download

Download the latest release from [GitHub Releases](https://github.com/lvminhnhat/FileFilter/releases)

### Windows
**Option 1: Installer (Recommended)**
1. Download `FileFilter-Setup-1.0.0.exe`
2. Run the installer and follow the wizard
3. Launch from Start Menu or Desktop shortcut

**Option 2: Portable**
1. Download `FileFilter-1.0.0-Windows-x64.zip`
2. Extract the zip file
3. Run `FileFilter.exe`

### Linux
1. Download `FileFilter-1.0.0-Linux-x64.tar.gz`
2. Extract: `tar -xzvf FileFilter-1.0.0-Linux-x64.tar.gz`
3. Run: `./FileFilter-Linux/FileFilter`

### macOS
1. Download `FileFilter-1.0.0-macOS-x64.zip`
2. Extract and run `FileFilter`

## Development

### Prerequisites
- Node.js 16+
- Neutralino CLI: `npm install -g @neutralinojs/neu`

### Setup
```bash
git clone https://github.com/lvminhnhat/FileFilter.git
cd FileFilter
neu update
```

### Run in development mode
```bash
neu run
```

### Build for production
```bash
neu build --release
```

Or use the build scripts:
```bash
# Linux/macOS
chmod +x scripts/build-release.sh
./scripts/build-release.sh

# Windows
scripts\build-release.bat
```

### Create Windows Installer
1. Install [Inno Setup](https://jrsoftware.org/isinfo.php)
2. Open `installer/inno-setup/setup.iss`
3. Compile to create the installer

## Tech Stack

- **Neutralino.js** - Lightweight desktop framework (~3MB app size)
- **Vanilla JavaScript** - No heavy frameworks
- **HTML5 Canvas** - Image processing and compression
- **CSS3** - Modern styling with CSS variables

## App Size

| Platform | Size |
|----------|------|
| Windows x64 | ~3 MB |
| Linux x64 | ~2 MB |
| macOS x64 | ~2.5 MB |

## License

MIT License - See [LICENSE](LICENSE) file

## Author

[lvminhnhat](https://github.com/lvminhnhat)

## Changelog

### v1.0.0
- Added image format conversion (PNG, JPG, WebP, GIF, BMP)
- Added image compression with quality and size control
- New tabbed interface for better organization
- Added Windows installer (NSIS/Inno Setup)
- Improved UI/UX with modern design
- Added batch processing support
