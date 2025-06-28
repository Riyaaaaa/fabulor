# Release Process

This document outlines the process for creating and publishing releases of Fabulor.

## Prerequisites

1. **Icons**: Ensure all required icon files are present in the `assets/` directory:
   - `icon.icns` (macOS)
   - `icon.ico` (Windows) 
   - `icon.png` (Linux)

2. **Dependencies**: Install electron-builder dependencies:
   ```bash
   npm install
   ```

3. **GitHub Token**: Ensure you have write access to the repository for automated releases.

## Release Steps

### 1. Prepare Release
Run the preparation script to check everything is ready:
```bash
npm run prepare-release
```

### 2. Update Version
Use npm to bump the version (automatically runs prepare-release):
```bash
# For bug fixes
npm version patch

# For new features  
npm version minor

# For breaking changes
npm version major
```

### 3. Push to GitHub
Push the commit and tags to trigger CI/CD:
```bash
git push origin main --tags
```

### 4. Monitor CI/CD
- GitHub Actions will automatically build for Windows, macOS, and Linux
- Artifacts will be attached to the GitHub release
- Check the Actions tab for build status

## Manual Build (Development)

### Build for Current Platform
```bash
npm run dist
```

### Build for Specific Platforms
```bash
npm run build:win    # Windows
npm run build:mac    # macOS  
npm run build:linux  # Linux
```

### Build All Platforms (requires each OS)
```bash
npm run build
```

## Distribution Formats

### Windows
- `fabulor-setup-1.0.0.exe` - NSIS installer
- `fabulor-1.0.0-win.zip` - Portable version

### macOS
- `fabulor-1.0.0.dmg` - DMG disk image
- `fabulor-1.0.0-mac.zip` - ZIP archive

### Linux
- `fabulor-1.0.0.AppImage` - AppImage (portable)
- `fabulor_1.0.0_amd64.deb` - Debian package

## Troubleshooting

### Common Issues

1. **Missing Icons**: Build will complete but use default icons
   - Solution: Add proper icon files to `assets/` directory

2. **Build Fails on Different OS**: 
   - Windows builds require Windows or WSL
   - macOS builds require macOS
   - Linux builds work on any platform

3. **GitHub Release Fails**:
   - Check GitHub token permissions
   - Ensure repository settings allow GitHub Actions
   - Verify tags are pushed correctly

### Debug Build Issues
```bash
# Enable verbose logging
DEBUG=electron-builder npm run dist

# Build without publishing
npm run dist
```

## GitHub Actions Workflows

### `build.yml`
- Triggers on pushes to main/develop branches and PRs
- Builds application for all platforms
- Uploads artifacts for testing

### `release.yml` 
- Triggers on version tags (v*)
- Builds and publishes to GitHub Releases
- Creates distributable packages for all platforms

## Repository Settings

Ensure the following are configured in your GitHub repository:

1. **Actions Permissions**: Allow read and write permissions
2. **Environment Variables**: `GITHUB_TOKEN` is automatically provided
3. **Branch Protection**: Configure rules for main branch if needed

## Security Notes

- Icons and assets are included in the final build
- Dependencies are bundled (only js-yaml in production)
- No sensitive data should be included in the repository
- All builds are signed with default Electron certificates