import * as fs from "node:fs";
import * as path from "node:path";

export interface SyncResult {
  copied: string[];
}

/**
 * Copy every canonical SKILL.md from the package's `skills/` directory into
 * `<projectRoot>/.claude/skills/<name>/SKILL.md`. Existing files are
 * overwritten — git is the safety net for local edits.
 */
export function syncSkills(projectRoot: string = process.cwd()): SyncResult {
  const sourceDir = path.join(__dirname, "..", "skills");
  const targetDir = path.join(projectRoot, ".claude", "skills");
  fs.mkdirSync(targetDir, { recursive: true });

  const copied: string[] = [];
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const srcFile = path.join(sourceDir, skillName, "SKILL.md");
    if (!fs.existsSync(srcFile)) continue;
    const destSkillDir = path.join(targetDir, skillName);
    fs.mkdirSync(destSkillDir, { recursive: true });
    fs.copyFileSync(srcFile, path.join(destSkillDir, "SKILL.md"));
    copied.push(skillName);
  }
  return { copied };
}
