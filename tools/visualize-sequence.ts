#!/usr/bin/env tsx
/**
 * Generates a PNG diagram of a sequence from its config.
 *
 * Usage: pnpm diagram <sequenceId>
 * Output: build/<sequenceId>/diagrams/diagram.png
 *
 * Requires: npx @mermaid-js/mermaid-cli (auto-invoked)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type { SequenceDefinition, SequenceStep, WaitStep } from "@step-func-emailer/shared";

const sequenceId = process.argv[2];
if (!sequenceId) {
  console.error("Usage: pnpm diagram <sequenceId>");
  process.exit(1);
}

const configPath = path.join(__dirname, `../sequences/${sequenceId}/sequence.config.ts`);
if (!fs.existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}

function esc(s: string): string {
  return s.replace(/"/g, "#quot;").replace(/[<>]/g, "");
}

function tpl(key: string): string {
  return key.split("/").pop() ?? key;
}

function waitLabel(s: WaitStep): string {
  if (s.days) return s.days === 1 ? "1 day" : `${s.days} days`;
  if (s.hours) return s.hours === 1 ? "1 hour" : `${s.hours} hours`;
  if (s.minutes) return s.minutes === 1 ? "1 min" : `${s.minutes} min`;
  return "wait";
}

let _n = 0;
function id(prefix: string): string {
  return `${prefix}${++_n}`;
}

interface Line {
  text: string;
}

function addSteps(lines: Line[], steps: SequenceStep[], prev: string): string {
  let cur = prev;

  for (const step of steps) {
    if (step.type === "send") {
      const n = id("s");
      lines.push({ text: `    ${n}["📧 ${esc(tpl(step.templateKey))}"]:::send` });
      lines.push({ text: `    ${cur} --> ${n}` });
      cur = n;
    } else if (step.type === "wait") {
      const n = id("w");
      lines.push({ text: `    ${n}["⏱ ${waitLabel(step)}"]:::wait` });
      lines.push({ text: `    ${cur} --> ${n}` });
      cur = n;
    } else if (step.type === "choice") {
      const fieldLabel = step.field.split(".").pop() ?? step.field;
      const ch = id("c");
      const merge = id("m");
      lines.push({ text: `    ${ch}{"${esc(fieldLabel)}"}:::choice` });
      lines.push({ text: `    ${cur} --> ${ch}` });
      lines.push({ text: `    ${merge}((" ")):::merge` });

      for (const branch of step.branches) {
        if (branch.steps.length > 0) {
          const end = addSteps(lines, branch.steps, ch);
          // Label on first edge
          const _firstNode = lines.find(
            (l) =>
              l.text.includes(`${ch} --> `) &&
              l.text.includes(branch.steps[0].type === "send" ? "📧" : ""),
          );
          // Add labeled edge from choice to first node of branch
          const branchFirst = findFirstChild(lines, ch, end, branch.steps);
          if (branchFirst) {
            replacePlainEdge(lines, ch, branchFirst, branch.value);
          }
          lines.push({ text: `    ${end} --> ${merge}` });
        } else {
          lines.push({ text: `    ${ch} -->|"${esc(branch.value)}"| ${merge}` });
        }
      }

      if (step.default && step.default.length > 0) {
        const end = addSteps(lines, step.default, ch);
        const defFirst = findFirstChild(lines, ch, end, step.default);
        if (defFirst) {
          replacePlainEdge(lines, ch, defFirst, "default");
        }
        lines.push({ text: `    ${end} --> ${merge}` });
      } else {
        lines.push({ text: `    ${ch} -->|"default"| ${merge}` });
      }

      cur = merge;
    } else if (step.type === "condition") {
      const ch = id("cond");
      const merge = id("m");
      const checkLabel =
        step.check === "has_been_sent"
          ? `sent ${tpl(step.templateKey ?? "")}?`
          : step.check === "subscriber_field_equals"
            ? `${step.field} = ${step.value}?`
            : `${step.field} exists?`;
      lines.push({ text: `    ${ch}{"${esc(checkLabel)}"}:::choice` });
      lines.push({ text: `    ${cur} --> ${ch}` });
      lines.push({ text: `    ${merge}((" ")):::merge` });

      if (step.then.length > 0) {
        const end = addSteps(lines, step.then, ch);
        const first = findFirstChild(lines, ch, end, step.then);
        if (first) replacePlainEdge(lines, ch, first, "yes");
        lines.push({ text: `    ${end} --> ${merge}` });
      } else {
        lines.push({ text: `    ${ch} -->|"yes"| ${merge}` });
      }

      if (step.else && step.else.length > 0) {
        const end = addSteps(lines, step.else, ch);
        const first = findFirstChild(lines, ch, end, step.else);
        if (first) replacePlainEdge(lines, ch, first, "no");
        lines.push({ text: `    ${end} --> ${merge}` });
      } else {
        lines.push({ text: `    ${ch} -->|"no"| ${merge}` });
      }

      cur = merge;
    }
  }

  return cur;
}

function findFirstChild(
  lines: Line[],
  parentId: string,
  _endId: string,
  _steps: SequenceStep[],
): string | null {
  // Find the first edge from parentId that was added by addSteps (plain edge, no label)
  for (const line of lines) {
    const match = line.text.match(new RegExp(`^\\s+${parentId} --> (\\S+)$`));
    if (match && match[1] !== parentId) {
      return match[1];
    }
  }
  return null;
}

function replacePlainEdge(lines: Line[], from: string, to: string, label: string): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].text.trim() === `${from} --> ${to}`) {
      lines[i].text = `    ${from} -->|"${esc(label)}"| ${to}`;
      return;
    }
  }
}

async function main() {
  const mod = await import(configPath);
  const def: SequenceDefinition = mod.default;

  _n = 0;
  const lines: Line[] = [];

  lines.push({ text: "graph TD" });
  lines.push({
    text: `    classDef trigger fill:#d97706,stroke:#92400e,color:#fff,font-weight:bold`,
  });
  lines.push({ text: `    classDef send fill:#2563eb,stroke:#1e40af,color:#fff` });
  lines.push({ text: `    classDef wait fill:#d97706,stroke:#92400e,color:#fff,font-weight:bold` });
  lines.push({
    text: `    classDef choice fill:#7c3aed,stroke:#5b21b6,color:#fff,font-weight:bold`,
  });
  lines.push({ text: `    classDef merge fill:#059669,stroke:#047857,color:#fff` });
  lines.push({
    text: `    classDef action fill:#4f46e5,stroke:#3730a3,color:#fff,font-weight:bold`,
  });
  lines.push({ text: "" });

  const trigger = id("t");
  lines.push({ text: `    ${trigger}["${esc(def.trigger.detailType)}"]:::trigger` });

  const reg = id("reg");
  lines.push({ text: `    ${reg}["Register"]:::action` });
  lines.push({ text: `    ${trigger} --> ${reg}` });

  const last = addSteps(lines, def.steps, reg);

  const comp = id("comp");
  lines.push({ text: `    ${comp}["Complete"]:::action` });
  lines.push({ text: `    ${last} --> ${comp}` });

  const done = id("done");
  lines.push({ text: `    ${done}([Done])` });
  lines.push({ text: `    ${comp} --> ${done}` });

  const mermaidSrc = lines.map((l) => l.text).join("\n");

  // Write .mmd file
  const diagDir = path.join(__dirname, `../build/${sequenceId}/diagrams`);
  fs.mkdirSync(diagDir, { recursive: true });
  const mmdPath = path.join(diagDir, "diagram.mmd");
  const pngPath = path.join(diagDir, "diagram.png");
  fs.writeFileSync(mmdPath, mermaidSrc);

  // Render to PNG via mermaid-cli
  try {
    execSync(
      `npx --yes @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${pngPath}" -b transparent -w 2048 2>&1`,
      { stdio: "pipe", timeout: 60_000 },
    );
    console.log(`Diagram: ${pngPath}`);
  } catch (err: any) {
    console.error("mmdc failed — falling back to .mmd file only");
    console.error(err.stderr?.toString() || err.message);
    console.log(`Mermaid source: ${mmdPath}`);
    console.log("Paste into https://mermaid.live to render");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
