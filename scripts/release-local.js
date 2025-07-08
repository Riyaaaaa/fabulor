#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    return execSync(command, { stdio: 'inherit', encoding: 'utf8' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return pkg.version;
}

function getDistFiles() {
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('dist/ directory not found. Run npm run dist first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(distDir)
    .filter(file => {
      // リリース用ファイルのみを選択
      return file.match(/\.(exe|dmg|deb|AppImage|zip)$/);
    })
    .map(file => path.join(distDir, file));
    
  return files;
}

async function main() {
  console.log('🚀 Starting local release process...\n');
  
  // 1. バージョン取得
  const version = getVersion();
  const tagName = `v${version}`;
  console.log(`📋 Version: ${version}`);
  
  // 2. ビルドファイル確認
  const distFiles = getDistFiles();
  if (distFiles.length === 0) {
    console.error('❌ No distributable files found in dist/');
    console.log('Run: npm run dist');
    process.exit(1);
  }
  
  console.log('📦 Found distributable files:');
  distFiles.forEach(file => console.log(`  - ${path.basename(file)}`));
  
  // 3. Gitタグ作成
  console.log(`\n🏷️  Creating tag ${tagName}...`);
  try {
    runCommand(`git tag ${tagName}`);
    runCommand(`git push origin ${tagName}`);
  } catch (error) {
    console.log('Tag already exists or push failed, continuing...');
  }
  
  // 4. GitHub CLI でリリース作成
  console.log('\n🎯 Creating GitHub release...');
  const releaseNotes = `## Release ${version}

### Changes
- Bug fixes and improvements
- See commit history for details

### Downloads
Choose the appropriate file for your platform:
- **Windows**: \`.exe\` (installer) or \`.zip\` (portable)
- **macOS**: \`.dmg\` (disk image)
- **Linux**: \`.AppImage\` (portable) or \`.deb\` (package)`;

  const filesArg = distFiles.join(' ');
  const releaseCommand = `gh release create ${tagName} --title "Release ${version}" --notes "${releaseNotes}" ${filesArg}`;
  
  runCommand(releaseCommand);
  
  console.log('\n✅ Release created successfully!');
  console.log(`🔗 View at: https://github.com/Riyaaaaa/fabulor/releases/tag/${tagName}`);
}

main().catch(console.error);