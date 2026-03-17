/**
 * Renders all onboarding email templates to static HTML in templates/onboarding/.
 * Uses Liquid syntax for template variables — React Email handles layout/styling,
 * Liquid handles runtime personalization.
 */
import { render } from "@react-email/render";
import * as fs from "node:fs";
import * as path from "node:path";

const EMAILS_DIR = path.join(__dirname, "emails");
const OUT_DIR = path.join(__dirname, "../../../templates/onboarding");

function collectTemplates(dir: string, relDir = ""): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    if (entry.isDirectory()) {
      results.push(...collectTemplates(path.join(dir, entry.name), path.join(relDir, entry.name)));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(path.join(relDir, entry.name));
    }
  }
  return results;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = collectTemplates(EMAILS_DIR);

  for (const file of files) {
    const modulePath = path.join(EMAILS_DIR, file);
    const mod = await import(modulePath);
    const Component = mod.default;

    if (!Component) {
      console.warn(`Skipping ${file}: no default export`);
      continue;
    }

    const html = await render(
      Component({
        firstName: "{{ firstName }}",
        unsubscribeUrl: "{{ unsubscribeUrl }}",
      }),
    );

    const outName = file.replace(/\.tsx$/, ".html");
    const outPath = path.join(OUT_DIR, outName);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`Rendered: onboarding/${outName}`);
  }

  console.log(`Done. ${files.length} template(s) written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
