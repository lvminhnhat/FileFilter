# FileFilter

Lightweight desktop application for scanning and filtering images by extension, size, and dimensions.

![FileFilter](resources/icons/appIcon.png)

## Features

- **Scan folders** - Select any folder to scan for images
- **Include subfolders** - Option to scan subdirectories recursively
- **Filter by extension** - JPG, PNG, GIF, WebP, BMP, SVG, ICO, TIFF or all
- **Filter by file size** - Set min/max file size in KB (can be toggled on/off)
- **Filter by dimensions** - Set min/max width and height in pixels
- **Preview thumbnails** - View image thumbnails with file info
- **Copy/Move images** - Copy or move selected images to a new folder
- **Export results** - Export file paths to TXT or copy to clipboard
- **Auto-update check** - Automatically checks for new versions on startup

## Screenshots

| Main Interface | Filter Options |
|----------------|----------------|
| Scan and view images | Filter by size, dimensions, format |

## Download

Download the latest release from [GitHub Releases](https://github.com/lvminhnhat/FileFilter/releases)

### Windows
1. Download `FileFilter-vX.X.X-windows-x64.zip`
2. Extract the zip file
3. Run `FileFilter-win_x64.exe`

### Linux
1. Download `FileFilter-vX.X.X-linux-x64.zip`
2. Extract and run `./FileFilter-linux_x64`

### macOS
1. Download `FileFilter-vX.X.X-mac-x64.zip` or `mac-arm64.zip` for M1/M2
2. Extract and run `FileFilter-mac_x64` or `FileFilter-mac_arm64`

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

Output files will be in `dist/FileFilter/`

## Tech Stack

- **Neutralino.js** - Lightweight desktop framework (~2-3MB app size)
- **Vanilla JavaScript** - No heavy frameworks
- **CSS3** - Modern styling with CSS variables

## App Size

| Platform | Size |
|----------|------|
| Windows x64 | ~2.6 MB |
| Linux x64 | ~1.7 MB |
| macOS x64 | ~2.3 MB |
| macOS ARM | ~2.2 MB |

## License

MIT License

## Author

[lvminhnhat](https://github.com/lvminhnhat)
