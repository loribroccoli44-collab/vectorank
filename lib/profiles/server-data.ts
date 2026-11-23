import "server-only";

import fs from "node:fs";
import path from "node:path";
import { dataReady, setData } from "./load";

// Build-time loader: reads the two committed files from disk into the shared store. Used only by pages that are
// rendered at build time (home, about) and by generateStaticParams. The browser fetches the same files instead.

const DIR = path.join(process.cwd(), "data", "demo");

export function primeServerData(): void {
  if (dataReady()) return;
  const artifactPath = path.join(DIR, "vectorank_demo_v1.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}. It is committed; restore it from git.`);
  }
  const llmPath = path.join(DIR, "vectorank_llm_evidence_v1.json");
  setData(
    JSON.parse(fs.readFileSync(artifactPath, "utf8")),
    fs.existsSync(llmPath) ? JSON.parse(fs.readFileSync(llmPath, "utf8")) : null,
  );
}
