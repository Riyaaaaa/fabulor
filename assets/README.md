# Assets Directory

This directory contains the application icons required for building distributable packages.

## Required Icon Files

You need to provide the following icon files:

### macOS
- `icon.icns` - macOS app icon (512x512, 256x256, 128x128, 64x64, 32x32, 16x16)

### Windows
- `icon.ico` - Windows app icon (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)

### Linux
- `icon.png` - Linux app icon (512x512 PNG)

## Creating Icons

You can use the following tools to create these icons from a single source image:

1. **Online converters:**
   - https://convertio.co/png-icns/
   - https://convertio.co/png-ico/

2. **Command line tools:**
   - `iconutil` (macOS) for .icns
   - `convert` (ImageMagick) for .ico and .png

3. **Recommended source:**
   - Start with a 1024x1024 PNG with transparent background
   - Use simple, recognizable design that works at small sizes

## Icon Guidelines

- Use high contrast colors
- Avoid text at small sizes
- Ensure transparency works well
- Test at 16x16 size for taskbar/dock visibility