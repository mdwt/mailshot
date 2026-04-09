import { syncSkills as runSync } from "@mailshot/skills";

/**
 * Copy the canonical Claude Code skills shipped with `@mailshot/skills` into
 * the project's `.claude/skills/` directory. Existing files are overwritten —
 * git is the safety net for local edits.
 */
export function syncSkills(projectRoot: string = process.cwd()) {
  const result = runSync(projectRoot);
  return {
    projectRoot,
    copied: result.copied,
    count: result.copied.length,
  };
}
