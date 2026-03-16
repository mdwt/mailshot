/**
 * Renders all React Email templates to static HTML files in the `out/` directory.
 * These HTML files use Liquid syntax for template variables — React Email handles
 * the layout/styling, Liquid handles runtime personalization.
 *
 * The rendered HTML files are deployed to S3 via CDK BucketDeployment.
 */
import { render } from "@react-email/render";
import * as fs from "node:fs";
import * as path from "node:path";

const EMAILS_DIR = path.join(__dirname, "emails");
const OUT_DIR = path.join(__dirname, "../../../out");

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(EMAILS_DIR).filter((f) => f.endsWith(".tsx"));

  for (const file of files) {
    const modulePath = path.join(EMAILS_DIR, file);
    const mod = await import(modulePath);
    const Component = mod.default;

    if (!Component) {
      console.warn(`Skipping ${file}: no default export`);
      continue;
    }

    // Render with Liquid placeholder props
    const html = await render(
      Component({
        firstName: "{{ firstName }}",
        unsubscribeUrl: "{{ unsubscribeUrl }}",
      }),
    );

    const outName = file.replace(/\.tsx$/, ".html");
    fs.writeFileSync(path.join(OUT_DIR, outName), html);
    console.log(`Rendered: ${outName}`);
  }

  console.log(`Done. ${files.length} template(s) written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
