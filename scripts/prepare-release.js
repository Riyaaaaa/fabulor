#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Release preparation script
 * Checks for required files and configurations before release
 */

const requiredAssets = [
  'assets/icon.icns',  // macOS
  'assets/icon.ico',   // Windows
  'assets/icon.png'    // Linux
];

const checkFiles = [
  'package.json',
  'main.js',
  'index.html',
  'style.css',
  'preload.js',
  'README.md',
  'LICENSE'
];

function checkFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function checkPackageJson() {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const errors = [];
    
    if (!pkg.version) errors.push('- Missing version in package.json');
    if (!pkg.description) errors.push('- Missing description in package.json');
    if (!pkg.author) errors.push('- Missing author in package.json');
    if (!pkg.build) errors.push('- Missing build configuration in package.json');
    if (!pkg.repository) errors.push('- Missing repository in package.json');
    
    return errors;
  } catch (err) {
    return ['- package.json is invalid or missing'];
  }
}

console.log('🔍 Checking release readiness...\n');

// Check required files
console.log('📁 Checking required files:');
let missingFiles = 0;
checkFiles.forEach(file => {
  const exists = checkFile(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) missingFiles++;
});

// Check asset files
console.log('\n🎨 Checking asset files:');
let missingAssets = 0;
requiredAssets.forEach(asset => {
  const exists = checkFile(asset);
  console.log(`  ${exists ? '✅' : '⚠️'} ${asset} ${exists ? '' : '(recommended for distribution)'}`);
  if (!exists) missingAssets++;
});

// Check package.json configuration
console.log('\n📦 Checking package.json configuration:');
const pkgErrors = checkPackageJson();
if (pkgErrors.length === 0) {
  console.log('  ✅ Package configuration looks good');
} else {
  console.log('  ❌ Package configuration issues:');
  pkgErrors.forEach(error => console.log(`    ${error}`));
}

// Summary
console.log('\n📋 Summary:');
const totalIssues = missingFiles + pkgErrors.length;
if (totalIssues === 0) {
  console.log('✅ Ready for release!');
  if (missingAssets > 0) {
    console.log('⚠️  Note: Some icons are missing. The build will work but may use default icons.');
  }
  console.log('\n🚀 To create a release:');
  console.log('1. Update version: npm version patch|minor|major');
  console.log('2. Push with tags: git push origin main --tags');
  console.log('3. GitHub Actions will automatically build and release');
} else {
  console.log(`❌ ${totalIssues} issue(s) need to be resolved before release`);
  process.exit(1);
}

if (missingAssets > 0) {
  console.log('\n💡 To add icons:');
  console.log('- Create 1024x1024 PNG source image');
  console.log('- Convert to required formats (see assets/README.md)');
  console.log('- Place in assets/ directory');
}