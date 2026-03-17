import * as fs from "node:fs";
import * as path from "node:path";
import type { SequenceDefinition } from "@step-func-emailer/shared";

/**
 * Scans sequences/ * /sequence.config.ts and loads each definition.
 * Works because CDK is invoked via tsx which registers the TS loader.
 */
export function loadSequenceConfigs(
  sequencesDir?: string,
): SequenceDefinition[] {
  const dir =
    sequencesDir ?? path.resolve(__dirname, "../../../sequences");

  if (!fs.existsSync(dir)) {
    return [];
  }

  const definitions: SequenceDefinition[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const configPath = path.join(dir, entry.name, "sequence.config.ts");
    if (!fs.existsSync(configPath)) continue;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(configPath);
    const def: SequenceDefinition = mod.default ?? mod.sequence;

    if (!def) {
      throw new Error(
        `${configPath}: must export a default or named 'sequence' export`,
      );
    }
    if (!def.id) {
      throw new Error(`${configPath}: missing 'id'`);
    }
    if (!def.trigger?.detailType) {
      throw new Error(`${configPath}: missing 'trigger.detailType'`);
    }

    if (!Array.isArray(def.steps)) {
      throw new Error(`${configPath}: missing 'steps' array`);
    }
    if (!def.timeoutMinutes) {
      throw new Error(`${configPath}: missing 'timeoutMinutes'`);
    }

    definitions.push(def);
  }

  return definitions;
}
