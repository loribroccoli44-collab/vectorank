import type {
  CandidateProfile,
  LlmEvidenceArtifact,
  LlmRelation,
  Paper,
  ProfilesArtifact,
} from "./types";

// The app reads exactly two generated, committed files (the public demo dataset and the optional AI-extracted
// evidence). This module is the single in-memory store for both. At build time they are read from disk
// (server-data.ts); in the browser they are fetched once from the static /data/ files (DataGate.tsx). The data are
// read as written: nothing here recomputes or repairs them.

const SCHEMA = "vectorank.public_demo.v1";
const LLM_SCHEMA = "vectorank.public_llm_evidence.v1";

let artifactCache: ProfilesArtifact | null = null;
let byIdCache: Map<string, CandidateProfile> | null = null;
let papersCache: Map<string, Paper> | null = null;
let llmCache: LlmEvidenceArtifact | null | undefined;

export function dataReady(): boolean {
  return artifactCache !== null;
}

// Install the two documents (parsed JSON). Idempotent.
export function setData(artifactRaw: unknown, llmRaw: unknown | null): void {
  if (artifactCache) return;
  const artifact = artifactRaw as ProfilesArtifact;
  if (artifact.schema !== SCHEMA) {
    throw new Error(`Unexpected artifact schema "${artifact.schema}"; this UI reads ${SCHEMA}.`);
  }
  const llm = (llmRaw as LlmEvidenceArtifact | null) ?? null;
  if (llm && llm.schema !== LLM_SCHEMA) {
    throw new Error(`Unexpected schema "${llm.schema}"; expected ${LLM_SCHEMA}.`);
  }
  llmCache = llm;
  // AI-discovered profiles (separate, offline-generated file) join the list so search and routes resolve them like
  // any other candidate; they keep their own `discovery` marker and `source` on every relation.
  const known = new Set(artifact.profiles.map((p) => p.candidate_id));
  const discovered = (llm?.discovered_profiles ?? []).filter((p) => !known.has(p.candidate_id));
  if (discovered.length > 0) {
    artifact.profiles = [...artifact.profiles, ...discovered];
    artifact.counts = {
      ...artifact.counts,
      candidate_profiles: artifact.profiles.length,
      ai_discovered_profiles: discovered.length,
    };
  }
  artifactCache = artifact;
  byIdCache = new Map(artifact.profiles.map((p) => [p.candidate_id, p]));
  papersCache = new Map(Object.entries(artifact.papers));
}

export function loadProfiles(): ProfilesArtifact {
  if (!artifactCache) throw new Error("VectoRank data not loaded yet.");
  return artifactCache;
}

export function getProfile(candidateId: string): CandidateProfile | undefined {
  loadProfiles();
  return byIdCache!.get(candidateId);
}

// Bibliographic metadata is the PubMed record (title, journal, year), checked against the corpus title at build
// time. Only papers with displayed evidence are present.
export function loadPapers(): Map<string, Paper> {
  loadProfiles();
  return papersCache!;
}

// AI-extracted evidence is an optional second file, generated offline. The app never calls a model while browsing;
// when the file is absent nothing is shown.
export function loadLlmEvidence(): LlmEvidenceArtifact | null {
  return llmCache ?? null;
}

export function getLlmEvidence(candidateId: string): LlmRelation[] {
  return loadLlmEvidence()?.relations.filter((r) => r.candidate_id === candidateId) ?? [];
}
