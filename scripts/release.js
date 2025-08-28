#!/usr/bin/env node

/**
 * Release script for Cursor AI PR Reviewer
 * Handles building, tagging, and publishing releases
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ReleaseManager {
  constructor() {
    this.packageJson = require('../package.json');
    this.currentVersion = this.packageJson.version;
  }

  async release(versionType = 'patch') {
    try {
      console.log('🚀 Starting release process...');

      // Validate git status
      this.validateGitStatus();

      // Determine new version
      const newVersion = this.determineNewVersion(versionType);
      console.log(`📈 Version: ${this.currentVersion} → ${newVersion}`);

      // Confirm release
      if (!this.confirmRelease(newVersion)) {
        console.log('❌ Release cancelled');
        return;
      }

      // Build the project
      console.log('🔨 Building project...');
      this.runCommand('npm run build');

      // Run linting
      console.log('🔍 Running linting...');
      this.runCommand('npm run lint');

      // Check code formatting
      console.log('✨ Checking code formatting...');
      this.runCommand('npm run format:check');

      // Run tests
      console.log('🧪 Running tests...');
      this.runCommand('npm test');

      // Update version
      console.log(`📝 Updating version to ${newVersion}...`);
      this.runCommand(`npm version ${newVersion} --no-git-tag-version`);

      // Update package.json version in dist
      this.updateDistPackageJson(newVersion);

      // Commit changes
      console.log('📤 Committing changes...');
      this.runCommand('git add .');
      this.runCommand(`git commit -m "chore: release v${newVersion}"`);

      // Create release branch with built files
      console.log('🌿 Creating release branch with built files...');
      this.createReleaseBranch(newVersion);

      // Create tags
      console.log('🏷️  Creating tags...');
      this.createTags(newVersion);

      // Push to GitHub
      console.log('🌐 Pushing to GitHub...');
      this.runCommand('git push origin main');
      this.runCommand('git push --tags');

      console.log('✅ Release completed successfully!');
      console.log(`🎉 Version ${newVersion} is now available`);
      console.log('');
      console.log('📋 Release Summary:');
      console.log(`   Tag: v${newVersion}`);
      console.log(`   Branch: main`);
      console.log(`   Commit: ${this.getGitCommit()}`);

    } catch (error) {
      console.error('❌ Release failed:', error.message);
      process.exit(1);
    }
  }

  validateGitStatus() {
    // Check if git is available
    try {
      this.runCommand('git --version', { silent: true });
    } catch {
      throw new Error('Git is not available');
    }

    // Check if we're in a git repository
    try {
      this.runCommand('git status', { silent: true });
    } catch {
      throw new Error('Not in a git repository');
    }

    // Check for uncommitted changes
    const status = this.runCommand('git status --porcelain', { silent: true });
    if (status.trim()) {
      throw new Error('Working directory is not clean. Commit or stash changes first.');
    }

    // Check if we're on main/master branch
    const branch = this.runCommand('git branch --show-current', { silent: true }).trim();
    if (!['main', 'master'].includes(branch)) {
      console.warn(`⚠️  Warning: Releasing from branch '${branch}' instead of main/master`);
    }
  }

  determineNewVersion(versionType) {
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);

    switch (versionType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        // Check if it's a specific version
        if (/^\d+\.\d+\.\d+$/.test(versionType)) {
          return versionType;
        }
        throw new Error(`Invalid version type: ${versionType}`);
    }
  }

  confirmRelease(newVersion) {
    // In CI environments, auto-confirm
    if (process.env.CI) {
      return true;
    }

    // Simple confirmation (in real scenario, you might want to use a library like inquirer)
    console.log(`\n🔍 Release Summary:`);
    console.log(`   Current version: ${this.currentVersion}`);
    console.log(`   New version: ${newVersion}`);
    console.log(`   This will create tags and push to GitHub.\n`);

    // For automation, we'll auto-confirm
    // In interactive mode, you'd want to prompt the user
    return true;
  }

  createReleaseBranch(version) {
    const releaseBranch = `release-v${version}`;
    const currentBranch = this.runCommand('git branch --show-current', { silent: true }).trim();
    
    try {
      // Create a new branch for the release
      console.log(`📦 Creating release branch: ${releaseBranch}`);
      this.runCommand(`git checkout -b ${releaseBranch}`);
      
      // Add the built files to this branch
      this.runCommand('git add dist/ --force');
      this.runCommand(`git commit -m "chore: add built files for release v${version}"`);
      
      // Push the release branch
      this.runCommand(`git push origin ${releaseBranch}`);
      
      // Switch back to the original branch
      this.runCommand(`git checkout ${currentBranch}`);
      
    } catch (error) {
      // If something goes wrong, try to get back to the original branch
      try {
        this.runCommand(`git checkout ${currentBranch}`, { silent: true });
      } catch {}
      throw error;
    }
  }

  createTags(version) {
    const specificTag = `v${version}`;
    const majorTag = `v${version.split('.')[0]}`;
    const releaseBranch = `release-v${version}`;

    // Create specific version tag pointing to the release branch
    this.runCommand(`git tag -a ${specificTag} refs/heads/${releaseBranch} -m "Release ${specificTag}"`);

    // Update/create major version tag (for auto-updates)
    try {
      // Delete existing major tag if it exists
      this.runCommand(`git tag -d ${majorTag}`, { silent: true });
      this.runCommand(`git push origin :refs/tags/${majorTag}`, { silent: true });
    } catch {
      // Tag might not exist, that's okay
    }

    // Create new major tag pointing to the release branch
    this.runCommand(`git tag -a ${majorTag} refs/heads/${releaseBranch} -m "Update ${majorTag} to ${specificTag}"`);
  }

  updateDistPackageJson(version) {
    const distPackageJsonPath = path.join(__dirname, '../dist/package.json');
    
    if (fs.existsSync(distPackageJsonPath)) {
      const distPackageJson = JSON.parse(fs.readFileSync(distPackageJsonPath, 'utf8'));
      distPackageJson.version = version;
      fs.writeFileSync(distPackageJsonPath, JSON.stringify(distPackageJson, null, 2));
    }
  }

  runCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });
      return result;
    } catch (error) {
      if (!options.silent) {
        throw error;
      }
      return '';
    }
  }

  getGitCommit() {
    try {
      return this.runCommand('git rev-parse HEAD', { silent: true }).trim().substring(0, 7);
    } catch {
      return 'unknown';
    }
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';

  const releaseManager = new ReleaseManager();
  releaseManager.release(versionType);
}

if (require.main === module) {
  main();
}

module.exports = { ReleaseManager };
