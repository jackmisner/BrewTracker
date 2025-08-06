#!/usr/bin/env node

/**
 * Version Sync Script
 *
 * This script updates the version constant in src/constants/version.ts
 * to match the version in package.json. It's called automatically
 * when running npm version commands.
 */

const fs = require("fs");
const path = require("path");

function syncVersion() {
  try {
    // Read package.json
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    if (!packageJson.version) {
      throw new Error("No version found in package.json");
    }

    const version = packageJson.version;

    // Validate version string contains only safe characters
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\-._]*)?$/.test(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    // Ensure constants directory exists
    const constantsDir = path.join(__dirname, "..", "src", "constants");
    if (!fs.existsSync(constantsDir)) {
      fs.mkdirSync(constantsDir, { recursive: true });
    }

    // Update version.ts
    const versionFilePath = path.join(constantsDir, "version.ts");
    const versionFileContent = `/**
 * Application version constant
 * 
 * This file is automatically updated when running npm version commands.
 * Do not edit manually - it will be overwritten.
 */
export const APP_VERSION = "${version}";`;

    fs.writeFileSync(versionFilePath, versionFileContent);
    console.log(`✅ Version constant updated to ${version}`);
  } catch (error) {
    console.error("❌ Error syncing version:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncVersion();
}

module.exports = syncVersion;
