#!/usr/bin/env node
// Self-check of the public VectoRank repository. Node only, no dependencies.
//
//   npm run check                                   dataset and repository checks
//   npm run check -- --base-url http://localhost:3000   also crawl a running server
//
// It verifies what can be verified from public material alone: the dataset's
// invariants (no abstracts, nothing labelled as human-reviewed, excerpts only
// with a verified Creative Commons licence and attribution, every paper linked
// to its own PubMed record), no local paths or digests in the repository, and,
// with --base-url, that every page responds and links only to papers in the
// dataset. The exclusion of papers reserved for evaluation is verified by the
// project's private pipeline, which holds the list; it is not published here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data", "demo", "vectorank_demo_v1.json");
const SKIP = new Set(["node_modules", ".git", ".next"]);
const BANNED_KEYS = new Set(["abstract", "supporting_text", "supportingText", "supporting_sentence_ids"]);
const LOCAL_PATH = /\/(Users|home)\/[A-Za-z0-9._-]+\/|[A-Z]:\\Users\\/;
const DIGEST = /\b[0-9a-f]{64}\b/;
// Rendered links only: the streamed React payload may split a URL string across chunks.
const PUBMED = /href="https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/"/g;
const SELF = path.join("scripts", "check-public-demo.mjs");

let failed = false;
function report(name, problems, detail = "") {
  if (problems.length) {
    failed = true;
    console.log(`FAIL  ${name}: ${problems.length} problem(s)${detail}`);
    for (const p of problems.slice(0, 15)) console.log(`        ${p}`);
  } else {
    console.log(`PASS  ${name}${detail}`);
  }
}

function bannedKeys(node, trail, out) {
  if (Array.isArray(node)) node.forEach((v, i) => bannedKeys(v, `${trail}[${i}]`, out));
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) {
      if (BANNED_KEYS.has(k)) out.push(`${trail}.${k}`);
      bannedKeys(v, `${trail}.${k}`, out);
    }
}

function checkDataset(data) {
  const problems = [];
  if (data.schema !== "vectorank.public_demo.v1") problems.push(`schema ${data.schema}`);
  bannedKeys(data, "$", problems);
  const papers = data.papers;
  const evidence = data.profiles.flatMap((p) => p.evidence);
  const cited = new Set(evidence.map((e) => e.pmid));
  const listed = new Set(Object.keys(papers));
  if (cited.size !== listed.size || [...cited].some((p) => !listed.has(p)))
    problems.push("papers and evidence PMIDs differ");
  for (const [pmid, paper] of Object.entries(papers)) {
    if (paper.pubmed_url !== `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`) problems.push(`paper ${pmid}: PubMed URL`);
    if (!paper.title) problems.push(`paper ${pmid}: no title`);
  }
  if (data.counts.reviewed_relations !== 0) problems.push("reviewed_relations is not 0");
  for (const e of evidence) {
    if (e.review_status !== "unreviewed") problems.push(`${e.relation_ref}: review_status ${e.review_status}`);
    if (e.excerpt === null) {
      if (!e.excerpt_withheld_reason) problems.push(`${e.relation_ref}: withheld without reason`);
      continue;
    }
    const paper = papers[e.pmid];
    if (e.excerpt_basis !== "open_license" || !(paper.license ?? "").startsWith("cc"))
      problems.push(`${e.relation_ref}: excerpt without a Creative Commons licence`);
    if (!paper.attribution || !paper.license_source_url)
      problems.push(`${e.relation_ref}: excerpt without attribution or licence record`);
  }
  return { problems, evidence, papers };
}

function repositoryFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) repositoryFiles(full, out);
    else out.push(full);
  }
  return out;
}

function checkRepository() {
  const problems = [];
  const files = repositoryFiles(ROOT).filter((f) => !/\.(png|jpg|jpeg|gif|ico|webp)$/i.test(f));
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (rel === SELF) continue;
    const text = fs.readFileSync(file, "utf8");
    const local = text.match(LOCAL_PATH);
    if (local) problems.push(`${rel}: local path '${local[0]}'`);
    const digest = rel === "package-lock.json" ? null : text.match(DIGEST);
    if (digest) problems.push(`${rel}: sha256-like digest`);
  }
  return { problems, count: files.length };
}

async function crawl(base, data) {
  const problems = [];
  let links = 0;
  const pages = ["/", "/search", "/about", "/results?n=400", "/results?tissue=CNS&model=nonhuman_primate", "/results?q=AAV9"];
  for (const p of data.profiles) pages.push(`/candidate/${encodeURIComponent(p.candidate_id)}?limit=600`);
  pages.push("/does-not-exist");
  for (const page of pages) {
    const res = await fetch(base + page);
    const body = await res.text();
    const expected = page === "/does-not-exist" ? 404 : 200;
    if (res.status !== expected) problems.push(`${page}: HTTP ${res.status}, expected ${expected}`);
    for (const [, pmid] of body.matchAll(PUBMED)) {
      links += 1;
      if (!(pmid in data.papers)) problems.push(`${page}: PubMed link to ${pmid}, not in the dataset`);
    }
  }
  if (links === 0) problems.push("no PubMed link found on any page");
  return { problems, count: pages.length, links };
}

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base-url");
const base = baseIdx >= 0 ? args[baseIdx + 1]?.replace(/\/$/, "") : null;

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const ds = checkDataset(data);
report("dataset", ds.problems, ` (${Object.keys(ds.papers).length} papers, ${ds.evidence.length} relations)`);
const repo = checkRepository();
report("repository", repo.problems, ` (${repo.count} files)`);
if (base) {
  const c = await crawl(base, data);
  report("crawl", c.problems, ` (${c.count} pages, ${c.links} PubMed links at ${base})`);
}
console.log(failed ? "FAIL — public demo check" : "PASS — public demo check");
process.exit(failed ? 1 : 0);
