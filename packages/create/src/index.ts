#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const projectName = process.argv[2];
if (!projectName) {
  console.error("Usage: npx create-mailshot <project-name>");
  process.exit(1);
}

const targetDir = path.resolve(process.cwd(), projectName);
if (fs.existsSync(targetDir)) {
  console.error(`Directory ${projectName} already exists.`);
  process.exit(1);
}

const templateDir = path.join(__dirname, "../template");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    // Rename _gitignore → .gitignore (npm strips dotfiles)
    const destName = entry.name === "_gitignore" ? ".gitignore" : entry.name;
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Creating ${projectName}...`);
copyDir(templateDir, targetDir);

// Install dependencies
console.log("\nInstalling dependencies...");
try {
  execSync("pnpm install", { cwd: targetDir, stdio: "inherit" });
} catch {
  console.log("pnpm not found, trying npm...");
  execSync("npm install", { cwd: targetDir, stdio: "inherit" });
}

// Git init + initial commit
console.log("\nInitializing git repository...");
execSync("git init", { cwd: targetDir, stdio: "inherit" });
execSync("git add -A", { cwd: targetDir, stdio: "inherit" });
execSync('git commit -m "Initial project scaffold"', {
  cwd: targetDir,
  stdio: "inherit",
});

console.log(`
Done! Created ${projectName}

Next steps:
  cd ${projectName}
  claude                    # Open Claude Code
  /setup-env                # Configure AWS environment
  /create-sequence          # Create your first email sequence
  /deploy                   # Deploy to AWS
`);
