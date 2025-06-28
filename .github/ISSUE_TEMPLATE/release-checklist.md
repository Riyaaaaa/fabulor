---
name: Release Checklist
about: Checklist for preparing a new release
title: 'Release v[VERSION]'
labels: release
assignees: ''
---

## Pre-Release Checklist

### Code Quality
- [ ] All tests passing
- [ ] No critical bugs in main branch
- [ ] Code review completed for major changes
- [ ] Documentation updated

### Release Preparation  
- [ ] Version number decided (patch/minor/major)
- [ ] CHANGELOG.md updated with new features/fixes
- [ ] Icons present in assets/ directory
- [ ] Run `npm run prepare-release` successfully

### Build & Test
- [ ] Local build successful (`npm run dist`)
- [ ] Test built application on target platforms
- [ ] Verify all features work in built version

### Release Process
- [ ] Create release branch (if needed)
- [ ] Run `npm version [patch|minor|major]`
- [ ] Push tags: `git push origin main --tags`
- [ ] Monitor GitHub Actions build
- [ ] Verify release artifacts are created

### Post-Release
- [ ] Test download and installation of releases
- [ ] Update main branch if release branch was used
- [ ] Announce release (if applicable)
- [ ] Update project documentation with new version

## Release Notes Template

```markdown
## What's New
- 

## Bug Fixes
- 

## Technical Changes
- 

## Download
- Windows: [fabulor-setup-x.x.x.exe]
- macOS: [fabulor-x.x.x.dmg]  
- Linux: [fabulor-x.x.x.AppImage]
```

## Notes
- Release will be automatically created by GitHub Actions when tags are pushed
- Builds will be attached to the GitHub release
- Make sure to test the final release artifacts before announcing