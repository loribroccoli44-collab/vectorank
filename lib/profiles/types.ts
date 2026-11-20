// Shapes of the public demo artifact `data/demo/vectorank_demo_v1.json`
// (schema `vectorank.public_demo.v1`): candidate evidence profiles with public
// excerpts in place of supporting text, plus PubMed metadata per paper.
// Everything here mirrors what the pipeline writes; nothing is added or
// defaulted.

export type FacetEntry = {
  value: string;
  status: string; // observed | inferred, from the extractor's own candidateStatus
  relation_count: number;
  pmids: string[];
  sources: string[]; // relation_refs into `evidence`
};

export type OutcomeEntry = {
  outcome_type: string;
  direction: string | null; // null = the paper did not state a direction
  status: string; // observed | unknown
  relation_count: number;
  pmids: string[];
  sources?: string[];
};

export type EvidenceRelation = {
  relation_ref: string; // "<pmid>#<index>"
  pmid: string;
  surface_candidate: string; // the mention as written in the paper
  candidate_status: string; // explicit | inherited
  outcome_type: string;
  direction: string | null;
  tissue: string | null;
  model: string | null;
  route: string | null;
  experimental_context: string | null;
  comparators: string[];
  // The supporting sentence, only where the article's Creative Commons licence
  // is verified (Europe PMC licence metadata); otherwise null, with the reason,
  // and the reader goes to PubMed.
  excerpt: string | null;
  excerpt_basis: "open_license" | null;
  excerpt_withheld_reason: string | null;
  review_status: "unreviewed"; // no relation in this artifact has been checked by a human
  // Present only on AI-extracted relations (schema vectorank.public_llm_evidence.v1).
  source?: "llm_gemini";
  shared_claim_with?: string[]; // other capsids named in the same source sentence
  flags?: string[]; // downstream qualifications (llm_downstream): direction withheld, identity resolved from the source
};

export type CandidateProfile = {
  candidate_id: string;
  canonical_name: string;
  candidate_type: string;
  candidate_type_note: string;
  identity_status: string;
  identity_rules: string[];
  aliases: { surface: string; relation_count: number }[];
  paper_count: number;
  relation_count: number;
  tissues: FacetEntry[];
  models: FacetEntry[];
  routes: FacetEntry[];
  outcomes: OutcomeEntry[];
  unknown_facets: { facet: string; relations_without_value: number; reason: string }[];
  contradiction_flags: { outcome_type: string; directions: string[]; note: string }[];
  evidence: EvidenceRelation[];
  // Present only on AI-discovered profiles: a capsid with no rule-based evidence
  // whose name passed deterministic checks. Not a validated capsid.
  discovery?: {
    state: "ai_discovered";
    label: string;
    source: string;
    identity_basis: string;
    // Where the capsid is named. Shown without outcome or direction: a result is
    // only displayed as a claim when its own sentence states a tissue, model or route.
    identity_sources: {
      relation_ref: string;
      pmid: string;
      surface_candidate: string;
      shared_claim_with: string[];
      excerpt: string | null;
      excerpt_basis: "open_license" | null;
      excerpt_withheld_reason: string | null;
    }[];
  };
};

export type Mention = {
  surface: string;
  relation_count: number;
  reason?: string | null;
};

export type ProfilesArtifact = {
  schema: string;
  caveat: string;
  provenance: Record<string, string | null>;
  policy: Record<string, unknown>;
  papers: Record<string, Paper>;
  counts: {
    relations_total: number;
    mentions_resolved: number;
    mentions_generic: number;
    mentions_unresolved: number;
    mentions_non_candidate: number;
    candidate_profiles: number;
    ai_discovered_profiles?: number;
    papers_with_evidence: number;
    attributed_relations: number;
    reviewed_relations: number;
  };
  generic_mentions: Mention[];
  unresolved_mentions: Mention[];
  non_candidate_mentions: Mention[];
  profiles: CandidateProfile[];
};

export type Paper = {
  pmid: string;
  title: string;
  authors: string | null; // first authors as listed on PubMed, "et al." beyond three
  journal: string | null;
  year: string | null;
  doi: string | null;
  pmcid: string | null;
  license: string | null; // Europe PMC licence, e.g. "cc by"; null when not openly licensed
  pubmed_url: string;
  link_verified: string;
  excerpt_basis: "open_license" | "withheld";
  // Present only for openly licensed papers: where the licence is stated, and
  // the attribution line shown under every reproduced excerpt.
  license_source_url?: string;
  attribution?: string;
};

// ---------------------------------------------------------------------------
// AI-extracted evidence (`data/demo/vectorank_llm_evidence_v1.json`, schema
// `vectorank.public_llm_evidence.v1`). A SEPARATE file from the rule-based
// artifact: the two are shown side by side, never merged or compared.
// ---------------------------------------------------------------------------

export type LlmRelation = {
  relation_ref: string; // "llm:<pmid>#<index>"
  source: "llm_gemini";
  review_status: "unreviewed";
  pmid: string;
  candidate_id: string;
  canonical_name: string;
  surface_candidate: string;
  candidate_status: string;
  comparators: string[];
  comparison_axis: string;
  outcome_type: string;
  direction: string | null;
  tissue: string | null;
  model: string | null;
  route: string | null;
  cargo: string | null;
  promoter: string | null;
  genome_configuration: string | null;
  sentence_ids: number[];
  flags?: string[]; // llm_downstream qualifications (see LlmEvidenceCard)
  shared_claim_with: string[];
  excerpt: string | null;
  excerpt_basis: "open_license" | null;
  excerpt_withheld_reason: string | null;
};

export type LlmEvidenceArtifact = {
  schema: string;
  label: string; // "AI-extracted — not independently validated"
  caveat: string;
  extraction: { engine: string; model: string; schema: string };
  discovery_caveat: string;
  counts: Record<string, unknown>;
  relations: LlmRelation[];
  discovered_profiles: CandidateProfile[];
};
