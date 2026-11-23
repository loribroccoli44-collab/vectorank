// Copies the two committed data files into public/data/ so the exported site serves them as static files.
// data/demo/ stays the single source of truth; public/data/ is generated and git-ignored.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["vectorank_demo_v1.json", "vectorank_llm_evidence_v1.json"];
fs.mkdirSync(path.join(ROOT, "public", "data"), { recursive: true });
for (const f of FILES) {
  const src = path.join(ROOT, "data", "demo", f);
  if (!fs.existsSync(src)) {
    if (f === FILES[0]) throw new Error(`Missing ${src}`);
    continue;
  }
  fs.copyFileSync(src, path.join(ROOT, "public", "data", f));
}
console.log("synced data/demo -> public/data");
