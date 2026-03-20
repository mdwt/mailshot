---
description: Import an existing deployed sequence from AWS into local code. Use when the user wants to import, pull, download, or reconstruct a sequence from a live deployment. Trigger phrases: "import sequence", "pull sequence from AWS", "download sequence", "reconstruct sequence".
---

# Import Sequence

Import a deployed sequence from AWS - reconstructs `sequence.config.ts`, HTML templates, and supporting files from live Step Functions + S3 + EventBridge resources.

## Usage

```
/import-sequence                    # lists sequences, prompts for selection
/import-sequence trial-expiring     # imports specific sequence
```

## Instructions

Follow this workflow exactly.

### Step 1: List available sequences

Call the `list_sequences` MCP tool. Present the results to the user as a numbered list showing:

- Sequence ID
- Whether a state machine exists
- Number of templates found

If a `sequenceId` argument was provided, skip to Step 3.

### Step 2: User selects a sequence

Ask the user which sequence to import. Wait for their response.

### Step 3: Check for conflicts

Check if `sequences/<sequenceId>/` already exists locally. If it does, warn the user and ask for confirmation before overwriting.

### Step 4: Export the sequence

Call the `export_sequence` MCP tool with the selected `sequenceId`. This returns:

- `definition` - the `SequenceDefinition` object (trigger, steps, events, timeoutMinutes)
- `templates` - array of `{ key, html }` pairs from S3
- `warnings` - any issues encountered during export

Display any warnings to the user.

### Step 5: Generate files

Create the following files:

**`sequences/<sequenceId>/package.json`:**

```json
{
  "name": "<sequenceId>",
  "version": "0.0.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc && pnpm render",
    "render": "tsx src/render.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "@mailshot/shared": "workspace:*|^0.1.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.21.0"
  }
}
```

Note: No React Email dependencies or `dev` script - imported templates are plain HTML, not `.tsx`.

**`sequences/<sequenceId>/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Note: No `"jsx": "react-jsx"` since there are no `.tsx` templates.

**`sequences/<sequenceId>/sequence.config.ts`:**

Generate from the exported `definition` object. The file must:

- Import `SequenceDefinition` type from `@mailshot/shared`
- Export default with `satisfies SequenceDefinition`
- Format the steps array readably (each step on its own lines)
- Use the exact values from the export (trigger, steps, events, timeoutMinutes)

Example output:

```typescript
import type { SequenceDefinition } from "@mailshot/shared";

export default {
  id: "trial-expiring",
  trigger: {
    detailType: "trial.expiring",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  timeoutMinutes: 43200,
  steps: [
    { type: "send", templateKey: "trial-expiring/warning", subject: "Your trial ends soon" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "trial-expiring/last-chance", subject: "Last chance" },
  ],
} satisfies SequenceDefinition;
```

**`sequences/<sequenceId>/src/emails/<name>.html`:**

For each template in the export, write the HTML file. The `<name>` is the part after the sequence prefix in the template key. For example, template key `trial-expiring/warning` → file `src/emails/warning.html`.

**`sequences/<sequenceId>/src/render.ts`:**

A simple copy script that copies `.html` files to the build directory (no React Email rendering needed):

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

const EMAILS_DIR = path.join(__dirname, "emails");
const OUT_DIR = path.join(__dirname, "../../../build/<sequenceId>/templates");

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(EMAILS_DIR).filter((f) => f.endsWith(".html"));

for (const file of files) {
  const name = path.basename(file, ".html");
  const src = path.join(EMAILS_DIR, file);
  const dest = path.join(OUT_DIR, `<sequenceId>/${name}.html`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied ${name}.html → build/<sequenceId>/templates/<sequenceId>/${name}.html`);
}
```

Replace `<sequenceId>` with the actual sequence ID in both the OUT_DIR path and the dest path.

### Step 6: Install dependencies

Run:

```bash
pnpm install
```

### Step 7: Build and validate

Run:

```bash
pnpm --filter <sequenceId> build
```

If the build succeeds, run `/validate-sequence <sequenceId>` to confirm the imported sequence passes all checks.

### Step 8: Report results

Summarize what was imported:

- Sequence ID
- Number of steps (and types breakdown)
- Number of templates imported
- Number of fire-and-forget events (if any)
- Any warnings from the export
- Remind the user that templates are HTML (not React Email `.tsx`) - they work for deployment but can't use `email dev`. They can be manually converted to React Email later.
