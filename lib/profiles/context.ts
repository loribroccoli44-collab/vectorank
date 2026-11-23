// Descriptive group-by counts over extracted evidence relations.
//
// Everything here counts rows of `profile.evidence` that the pipeline wrote.
// There is no score, rank, weight, confidence or fit in this file, and nothing
// is defaulted: a relation that does not state a facet is counted as
// "not stated", never as a guess. Every count can be traced to its relations.

import type {
  CandidateProfile,
  EvidenceRelation,
  ProfilesArtifact,
} from "./types";

export const NOT_STATED = "unstated";

export type Facet = "tissue" | "model" | "route";
export const FACETS: Facet[] = ["tissue", "model", "route"];

export type Context = Partial<Record<Facet, string>>;
export type EvidenceFilter = Context & {
  outcome?: string;
  direction?: string;
  pmid?: string;
};

type Params = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseContext(sp: Params): Context {
  const ctx: Context = {};
  for (const facet of FACETS) {
    const value = one(sp[facet]);
    if (value) ctx[facet] = value;
  }
  return ctx;
}

export function parseFilter(sp: Params): EvidenceFilter {
  const filter: EvidenceFilter = parseContext(sp);
  const outcome = one(sp.outcome);
  const direction = one(sp.direction);
  const pmid = one(sp.pmid);
  if (outcome) filter.outcome = outcome;
  if (direction) filter.direction = direction;
  if (pmid) filter.pmid = pmid;
  return filter;
}

export function toQuery(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function facetMatches(
  relation: EvidenceRelation,
  facet: Facet,
  wanted: string,
): boolean {
  const value = relation[facet];
  return wanted === NOT_STATED ? value === null : value === wanted;
}

export function relationMatches(
  relation: EvidenceRelation,
  filter: EvidenceFilter,
): boolean {
  for (const facet of FACETS) {
    const wanted = filter[facet];
    if (wanted && !facetMatches(relation, facet, wanted)) return false;
  }
  if (filter.outcome && relation.outcome_type !== filter.outcome) return false;
  if (filter.direction) {
    const direction = relation.direction ?? NOT_STATED;
    if (direction !== filter.direction) return false;
  }
  if (filter.pmid && relation.pmid !== filter.pmid) return false;
  return true;
}

export function filterEvidence(
  evidence: EvidenceRelation[],
  filter: EvidenceFilter,
): EvidenceRelation[] {
  return evidence.filter((relation) => relationMatches(relation, filter));
}

export function countBy<T>(
  rows: T[],
  key: (row: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export function distinctPmids(rows: EvidenceRelation[]): number {
  return new Set(rows.map((r) => r.pmid)).size;
}

// ---------------------------------------------------------------------------
// Per-candidate summary under a context
// ---------------------------------------------------------------------------

export type FacetCoverage = { match: number; other: number; notStated: number };

export type ContextSummary = {
  total: number;
  totalPapers: number;
  matching: EvidenceRelation[];
  matchingPapers: number;
  // Relations that do not match, but state nothing on at least one selected
  // facet and match on every other selected facet: unknown, not negative.
  unknownCompatible: number;
  coverage: Partial<Record<Facet, FacetCoverage>>;
  notStatedAmongMatching: Record<Facet, number>;
  directions: Record<string, number>;
  outcomeTypes: Record<string, number>;
};

export function summarize(
  profile: CandidateProfile,
  ctx: Context,
): ContextSummary {
  const selected = FACETS.filter((f) => ctx[f]);
  const evidence = profile.evidence;

  const matching = evidence.filter((r) => relationMatches(r, ctx));

  let unknownCompatible = 0;
  if (selected.length > 0) {
    for (const r of evidence) {
      if (relationMatches(r, ctx)) continue;
      const compatible = selected.every(
        (f) => r[f] === null || facetMatches(r, f, ctx[f]!),
      );
      if (compatible) unknownCompatible += 1;
    }
  }

  const coverage: Partial<Record<Facet, FacetCoverage>> = {};
  for (const f of selected) {
    const wanted = ctx[f]!;
    let match = 0;
    let notStated = 0;
    for (const r of evidence) {
      if (facetMatches(r, f, wanted)) match += 1;
      if (r[f] === null) notStated += 1;
    }
    // When the lens asks for "not stated", match === notStated by definition.
    const other = evidence.length - match - (wanted === NOT_STATED ? 0 : notStated);
    coverage[f] = { match, other, notStated };
  }

  const notStatedAmongMatching = {
    tissue: matching.filter((r) => r.tissue === null).length,
    model: matching.filter((r) => r.model === null).length,
    route: matching.filter((r) => r.route === null).length,
  };

  return {
    total: evidence.length,
    totalPapers: profile.paper_count,
    matching,
    matchingPapers: distinctPmids(matching),
    unknownCompatible,
    coverage,
    notStatedAmongMatching,
    directions: countBy(matching, (r) => r.direction ?? NOT_STATED),
    outcomeTypes: countBy(matching, (r) => r.outcome_type),
  };
}

// ---------------------------------------------------------------------------
// Evidence matrix (tissue x model), derived from the relations
// ---------------------------------------------------------------------------

export type Matrix = {
  rows: string[]; // tissue values, NOT_STATED last
  cols: string[]; // model values, NOT_STATED last
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  total: number;
  max: number;
};

function ordered(totals: Record<string, number>): string[] {
  return Object.keys(totals).sort((a, b) => {
    if (a === NOT_STATED) return 1;
    if (b === NOT_STATED) return -1;
    return totals[b] - totals[a] || a.localeCompare(b);
  });
}

export function buildMatrix(evidence: EvidenceRelation[]): Matrix {
  const cells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let max = 0;
  for (const r of evidence) {
    const row = r.tissue ?? NOT_STATED;
    const col = r.model ?? NOT_STATED;
    cells[row] ??= {};
    cells[row][col] = (cells[row][col] ?? 0) + 1;
    rowTotals[row] = (rowTotals[row] ?? 0) + 1;
    colTotals[col] = (colTotals[col] ?? 0) + 1;
    max = Math.max(max, cells[row][col]);
  }
  return {
    rows: ordered(rowTotals),
    cols: ordered(colTotals),
    cells,
    rowTotals,
    colTotals,
    total: evidence.length,
    max,
  };
}

// ---------------------------------------------------------------------------
// Vocabulary for the context lens (values that occur in the data, with counts)
// ---------------------------------------------------------------------------

export function facetVocabulary(
  artifact: ProfilesArtifact,
): Record<Facet, { value: string; relations: number }[]> {
  const counts: Record<Facet, Record<string, number>> = {
    tissue: {},
    model: {},
    route: {},
  };
  for (const profile of artifact.profiles) {
    for (const r of profile.evidence) {
      for (const f of FACETS) {
        const value = r[f];
        if (value !== null) counts[f][value] = (counts[f][value] ?? 0) + 1;
      }
    }
  }
  const out = {} as Record<Facet, { value: string; relations: number }[]>;
  for (const f of FACETS) {
    out[f] = Object.entries(counts[f])
      .map(([value, relations]) => ({ value, relations }))
      .sort((a, b) => b.relations - a.relations || a.value.localeCompare(b.value));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Alias-aware candidate lookup
// ---------------------------------------------------------------------------

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

export type AliasMatch = {
  exact: boolean;
  via: string; // the name or alias that matched
  kind: "canonical name" | "alias" | "name contains";
};

export function matchAlias(
  profile: CandidateProfile,
  query: string,
): AliasMatch | null {
  const wanted = normalize(query);
  if (!wanted) return null;

  if (normalize(profile.canonical_name) === wanted) {
    return { exact: true, via: profile.canonical_name, kind: "canonical name" };
  }
  for (const alias of profile.aliases) {
    if (normalize(alias.surface) === wanted) {
      return { exact: true, via: alias.surface, kind: "alias" };
    }
  }
  if (normalize(profile.canonical_name).includes(wanted)) {
    return { exact: false, via: profile.canonical_name, kind: "name contains" };
  }
  for (const alias of profile.aliases) {
    if (normalize(alias.surface).includes(wanted)) {
      return { exact: false, via: alias.surface, kind: "name contains" };
    }
  }
  // Search convenience only (not an identity resolution): "AAV-PHP.B" is how the variant is usually written, while the
  // registry holds "AAV9-PHP.B". Drop a leading AAV/rAAV from the query and look for the rest as a part of a name.
  const rest = wanted.replace(/^r?aav/, "");
  if (rest !== wanted && rest.length >= 4 && /[a-z]/.test(rest)) {
    if (normalize(profile.canonical_name).includes(rest)) {
      return { exact: false, via: profile.canonical_name, kind: "name contains" };
    }
    for (const alias of profile.aliases) {
      if (normalize(alias.surface).includes(rest)) {
        return { exact: false, via: alias.surface, kind: "name contains" };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Presentation-layer identity review flag
//
// STOPGAP, not an identity resolution. Identity is resolved by typography
// only, and some extracted strings are sentence fragments rather than names.
// Until extraction and identity resolution improve, such profiles are kept out of
// the main list and shown in a collapsed "identity under review" group with
// the reason. They are never merged, renamed, re-attributed or hidden.
// ---------------------------------------------------------------------------

const STATE_TAIL = new Set([
  "transduced",
  "infected",
  "transfected",
  "empty",
  "full",
  "wild",
  "were",
  "two",
  "human",
  "resistant",
  "neutralizing",
  "based",
]);

function bracketsBalanced(text: string): boolean {
  const open: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const close = new Set(Object.values(open));
  const stack: string[] = [];
  for (const ch of text) {
    if (ch in open) stack.push(open[ch]);
    else if (close.has(ch) && stack.pop() !== ch) return false;
  }
  return stack.length === 0;
}

export function identityReview(name: string): string | null {
  if (name.includes(" + ")) {
    return "joins several entities with “+”: a combination or process, not one capsid";
  }
  if (!bracketsBalanced(name)) {
    return "unbalanced bracket: the extracted span looks cut off";
  }
  if (/[-./,:;+]$/.test(name)) {
    return "ends in a separator: the extracted span looks cut off";
  }
  if (/^r?AAV\d{1,2}-\d{1,2}$/i.test(name)) {
    return "two bare numbers joined by a hyphen: the string cannot say whether this is a range, a hybrid or a comparison";
  }
  if (/^r?AAV[0-9a-z./]*-AAV[0-9a-z./]*$/i.test(name)) {
    return "two AAV tokens joined by a hyphen: likely two mentions that were not split";
  }
  if (/^AAV(based|human)$/i.test(name)) {
    return "“AAV” plus an ordinary English word: not a designation";
  }
  const parts = name.split("-");
  const tail = parts[parts.length - 1];
  if (parts.length > 1 && /^[a-z]+$|^[A-Z][a-z]+$/.test(tail)) {
    if (STATE_TAIL.has(tail.toLowerCase()) || /^[A-Za-z]{4,}(ed|ing)$/.test(tail)) {
      return "ends in an ordinary English word (a state or participle): the span looks like sentence text, not a name";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Candidate search
// ---------------------------------------------------------------------------

export type CandidateResult = {
  profile: CandidateProfile;
  summary: ContextSummary;
  alias: AliasMatch | null;
  review: string | null;
};

export type SearchOutcome = {
  matches: CandidateResult[]; // >= 1 relation in the lens, identity not under review
  review: CandidateResult[]; // matches whose identity string is under review
  unknownOnly: CandidateResult[]; // no matching relation, but unstated on a selected facet
  totalCandidates: number;
};

export function searchCandidates(
  artifact: ProfilesArtifact,
  ctx: Context,
  query: string | undefined,
  order: "volume" | "name" = "volume",
): SearchOutcome {
  const hasContext = FACETS.some((f) => ctx[f]);
  const all: CandidateResult[] = [];

  for (const profile of artifact.profiles) {
    const alias = query ? matchAlias(profile, query) : null;
    if (query && !alias) continue;
    all.push({
      profile,
      summary: summarize(profile, ctx),
      alias,
      review: identityReview(profile.canonical_name),
    });
  }

  // Order is amount of matching evidence, then total evidence, then name. When
  // the user typed a name, exact name/alias hits come first. This is a
  // volume ordering, not a suitability ordering.
  const byVolume = (a: CandidateResult, b: CandidateResult) => {
    const exact = Number(b.alias?.exact ?? false) - Number(a.alias?.exact ?? false);
    if (exact !== 0) return exact;
    return (
      b.summary.matching.length - a.summary.matching.length ||
      b.summary.total - a.summary.total ||
      a.profile.canonical_name.localeCompare(b.profile.canonical_name)
    );
  };

  // Name order is purely alphabetical (numeric-aware, so AAV2 precedes AAV10).
  const byName = (a: CandidateResult, b: CandidateResult) =>
    a.profile.canonical_name.localeCompare(b.profile.canonical_name, undefined, {
      numeric: true,
      sensitivity: "base",
    }) || a.profile.candidate_id.localeCompare(b.profile.candidate_id);
  const compare = order === "name" ? byName : byVolume;

  // An AI-discovered capsid with no displayed claim has no relation to match; it is
  // listed only when the user searched for its name and chose no context lens.
  const withEvidence = all.filter(
    (r) =>
      r.summary.matching.length > 0 ||
      (Boolean(r.profile.discovery) && Boolean(r.alias) && !hasContext),
  );
  return {
    matches: withEvidence.filter((r) => !r.review).sort(compare),
    review: withEvidence.filter((r) => r.review).sort(compare),
    unknownOnly: hasContext
      ? all
          .filter(
            (r) =>
              r.summary.matching.length === 0 && r.summary.unknownCompatible > 0,
          )
          .sort(
            (a, b) =>
              b.summary.unknownCompatible - a.summary.unknownCompatible ||
              a.profile.canonical_name.localeCompare(b.profile.canonical_name),
          )
      : [],
    totalCandidates: artifact.profiles.length,
  };
}

// ---------------------------------------------------------------------------
// Labels (cosmetic only: the underlying values are never altered)
// ---------------------------------------------------------------------------

export const DIRECTION_ORDER = [
  "increased",
  "positive",
  "favorable",
  "reduced",
  "adverse",
  "no_detected_signal",
  NOT_STATED,
];

export const DIRECTION_LABEL: Record<string, string> = {
  increased: "increased",
  positive: "positive",
  favorable: "favorable",
  reduced: "reduced",
  adverse: "adverse",
  no_detected_signal: "no signal detected",
  [NOT_STATED]: "not reported",
};

export const OUTCOME_LABEL: Record<string, string> = {
  transduction_expression: "Transduction / expression",
  immune: "Immune response",
  manufacturing: "Manufacturing",
  mechanism: "Mechanism",
  safety: "Safety",
  efficacy: "Efficacy",
  durability: "Durability",
};

export function outcomeLabel(value: string): string {
  return OUTCOME_LABEL[value] ?? value.replace(/_/g, " ");
}

export function facetLabel(value: string): string {
  return value === NOT_STATED ? "not reported" : value.replace(/_/g, " ");
}

export function directionLabel(value: string | null): string {
  return DIRECTION_LABEL[value ?? NOT_STATED] ?? value ?? "not reported";
}

// ---------------------------------------------------------------------------
// Evidence profile of one candidate in a lens (descriptive counts only)
// ---------------------------------------------------------------------------

export type EvidenceProfile = {
  // Relations per supporting paper, largest first: the groups of evidence pips.
  paperGroups: number[];
  // Route values as extracted (NOT_STATED for relations that state none).
  routes: { value: string; n: number }[];
  attribution: { named: number; carried: number };
  // Matching relations whose outcome category is not one of the fixed slots.
  otherOutcomes: number;
};

export function evidenceProfile(
  summary: ContextSummary,
  slotKeys: string[],
): EvidenceProfile {
  const perPaper = countBy(summary.matching, (r) => r.pmid);
  const paperGroups = Object.entries(perPaper)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([, n]) => n);

  const routeCounts = countBy(summary.matching, (r) => r.route ?? NOT_STATED);
  const routes = Object.entries(routeCounts)
    .map(([value, n]) => ({ value, n }))
    .sort((a, b) => {
      if (a.value === NOT_STATED) return 1;
      if (b.value === NOT_STATED) return -1;
      return b.n - a.n || a.value.localeCompare(b.value);
    });

  const attribution = {
    named: summary.matching.filter((r) => r.candidate_status === "explicit").length,
    carried: summary.matching.filter((r) => r.candidate_status === "inherited").length,
  };

  const otherOutcomes = Object.entries(summary.outcomeTypes)
    .filter(([key]) => !slotKeys.includes(key))
    .reduce((n, [, count]) => n + count, 0);

  return { paperGroups, routes, attribution, otherOutcomes };
}
