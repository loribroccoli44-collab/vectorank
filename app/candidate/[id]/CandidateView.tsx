"use client";

import BackToResults from "../../_ui/BackToResults";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toParams } from "@/lib/profiles/params";
import { getLlmEvidence, getProfile, loadLlmEvidence, loadPapers } from "@/lib/profiles/load";
import {
  DIRECTION_ORDER,
  FACETS,
  NOT_STATED,
  buildMatrix,
  countBy,
  directionLabel,
  facetLabel,
  filterEvidence,
  identityReview,
  outcomeLabel,
  parseFilter,
  toQuery,
  type EvidenceFilter,
  type Facet,
} from "@/lib/profiles/context";
import { dossierHref, type DossierParams } from "@/lib/profiles/links";
import type { CandidateProfile, EvidenceRelation, Paper } from "@/lib/profiles/types";
import { Shell } from "../../_ui/chrome";
import {
  Chip,
  Derived,
  DirectionStrip,
  NotStated,
  SectionHeading,
  TextLink,
} from "../../_ui/atoms";
import EvidenceMatrix from "../../_ui/EvidenceMatrix";
import AtAGlance from "../../_ui/AtAGlance";
import EvidenceKey from "../../_ui/EvidenceKey";
import EvidenceCard from "../../_ui/EvidenceCard";
import LlmEvidenceCard from "../../_ui/LlmEvidenceCard";

// Screen 3: the candidate evidence dossier. Everything on this page is either
// a dataset field or a plain count over that candidate's own evidence relations,
// labelled "derived from N relations". There is no score and no ranking.
//
// Depth order: the matrix first (aggregate), then the relations behind it
// (inspect), then the sentence and PMID (source). Technical identity metadata
// is available but folded away so it does not compete with the evidence.

const LEDGER_PAGE = 12;

const FACET_NAME: Record<Facet, string> = {
  tissue: "Tissue",
  model: "Model / species",
  route: "Administration route",
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function yearOf(year?: string | null) {
  const n = Number(year);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function CandidateView({ id }: { id: string }) {
  const sp = toParams(useSearchParams());
  const profile = getProfile(decodeURIComponent(id));
  if (!profile) {
    return (
      <Shell active="candidate">
        <div className="vr-panel mt-6 p-8 text-center text-[14px] text-vr-muted">
          No capsid profile with this name exists in this collection.{" "}
          <Link href="/search" className="vr-focus text-vr-accent underline-offset-4 hover:underline">
            Search again
          </Link>
        </div>
      </Shell>
    );
  }

  const papers = loadPapers();
  const llmRelations = getLlmEvidence(profile.candidate_id);
  if (profile.discovery && profile.evidence.length === 0) {
    return <DiscoveredIdentityOnly profile={profile} papers={papers} />;
  }
  const filter: EvidenceFilter = parseFilter(sp);
  const limitRaw = typeof sp.limit === "string" ? Number(sp.limit) : LEDGER_PAGE;
  const limit = Math.max(LEDGER_PAGE, Math.min(limitRaw || LEDGER_PAGE, 600));
  const current: DossierParams = filter;

  const evidence = profile.evidence;
  const total = evidence.length;
  const review = identityReview(profile.canonical_name);

  const matrix = buildMatrix(evidence);
  const directions = countBy(evidence, (r) => r.direction ?? NOT_STATED);

  // Ledger: filtered, newest first.
  const filtered = filterEvidence(evidence, filter);
  const ledger = [...filtered].sort(
    (a, b) =>
      yearOf(papers.get(b.pmid)?.year) - yearOf(papers.get(a.pmid)?.year) ||
      a.pmid.localeCompare(b.pmid) ||
      a.relation_ref.localeCompare(b.relation_ref, undefined, { numeric: true }),
  );
  const activeFilters = (
    [
      ["tissue", filter.tissue],
      ["model", filter.model],
      ["route", filter.route],
      ["outcome", filter.outcome],
      ["direction", filter.direction],
      ["paper", filter.pmid],
    ] as const
  ).filter(([, v]) => v) as [string, string][];

  const filterKey: Record<string, keyof DossierParams> = {
    tissue: "tissue",
    model: "model",
    route: "route",
    outcome: "outcome",
    direction: "direction",
    paper: "pmid",
  };

  // Outcome table from the profile's outcome entries (real aggregation).
  const outcomeRows = new Map<string, Record<string, number>>();
  for (const o of profile.outcomes) {
    const row = outcomeRows.get(o.outcome_type) ?? {};
    row[o.direction ?? NOT_STATED] =
      (row[o.direction ?? NOT_STATED] ?? 0) + o.relation_count;
    outcomeRows.set(o.outcome_type, row);
  }
  const outcomeTypes = [...outcomeRows.entries()]
    .map(([type, row]) => ({
      type,
      row,
      total: Object.values(row).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total || a.type.localeCompare(b.type));
  const presentDirections = DIRECTION_ORDER.filter((d) =>
    outcomeTypes.some((o) => (o.row[d] ?? 0) > 0),
  );
  const mixed = new Set(profile.contradiction_flags.map((f) => f.outcome_type));

  // Per-facet stated / not-stated (derived).
  const facetInfo = FACETS.map((f) => {
    const entries =
      f === "tissue" ? profile.tissues : f === "model" ? profile.models : profile.routes;
    const notStated = evidence.filter((r) => r[f] === null).length;
    return { facet: f, entries, notStated, stated: total - notStated };
  });

  // Papers section: this candidate's papers, grouped from its relations.
  const byPaper = new Map<string, EvidenceRelation[]>();
  for (const r of evidence) {
    byPaper.set(r.pmid, [...(byPaper.get(r.pmid) ?? []), r]);
  }
  const paperRows = [...byPaper.entries()]
    .map(([pmid, rels]) => ({ pmid, rels, paper: papers.get(pmid) }))
    .sort(
      (a, b) =>
        b.rels.length - a.rels.length ||
        yearOf(b.paper?.year) - yearOf(a.paper?.year) ||
        a.pmid.localeCompare(b.pmid),
    );

  const backHref = `/results${toQuery({
    tissue: filter.tissue,
    model: filter.model,
    route: filter.route,
  })}`;

  // The canonical name may never appear verbatim as a written form (it can be a
  // normalized or registry name); in that case it has no count of its own.
  const canonicalCount = profile.aliases.find(
    (a) => a.surface === profile.canonical_name,
  )?.relation_count;
  const otherAliases = profile.aliases.filter(
    (a) => a.surface !== profile.canonical_name,
  );

  return (
    <Shell active="candidate">
      <BackToResults fallbackHref={backHref} />

      {/* ------------------------------------------------ identity header */}
      <section className="mt-5">
        <div className="vr-eyebrow">Capsid evidence profile</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <h1 className="vr-display break-words text-[48px] font-semibold leading-none text-vr-ink sm:text-[64px]">
            {profile.canonical_name}
          </h1>
          <div className="flex gap-10">
            <div>
              <div className="vr-num text-[34px] font-medium leading-none text-vr-ink">
                {profile.paper_count}
              </div>
              <div className="mt-2 text-[13px] text-vr-muted">
                scientific {profile.paper_count === 1 ? "publication" : "publications"}
              </div>
            </div>
            <div>
              <div className="vr-num text-[34px] font-medium leading-none text-vr-ink">
                {profile.relation_count}
              </div>
              <div className="mt-2 text-[13px] text-vr-muted">
                extracted {profile.relation_count === 1 ? "finding" : "findings"}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[13px] text-vr-faint">
          {plural(profile.tissues.length, "tissue")} ·{" "}
          {plural(profile.models.length, "model")} ·{" "}
          {plural(profile.routes.length, "delivery route")} reported
        </p>

        {profile.discovery ? (
          <div className="mt-5 rounded-[8px] border border-[#5a4a22] bg-[#d2b36a0d] px-4 py-3 text-[13px] leading-6 text-vr-note">
            <span className="font-medium">{profile.discovery.label}.</span>{" "}
            {loadLlmEvidence()?.discovery_caveat} Anything the cited
            sentence does not report is shown as not reported, never filled in.
            This profile has no rule-based evidence, and nothing here ranks or
            recommends the capsid.
          </div>
        ) : null}

        {review ? (
          <div className="mt-5 rounded-[8px] border border-[#5a4a22] bg-[#d2b36a0d] px-4 py-3 text-[13px] leading-6 text-vr-note">
            <span className="font-medium">Name under review.</span> This
            name {review}. It was matched by spelling only, and the evidence is
            shown as extracted.
          </div>
        ) : null}

        <details className="group mt-5 max-w-[760px]">
          <summary className="vr-focus inline-flex items-center gap-2 text-[12px] text-vr-faint hover:text-vr-muted">
            <span className="font-vr-mono group-open:hidden">▸</span>
            <span className="hidden font-vr-mono group-open:inline">▾</span>
            Name variants &amp; extraction details
          </summary>
          <div className="mt-3 space-y-4 rounded-[8px] border border-vr-line bg-vr-surface p-4 text-[13px] text-vr-muted">
            <div className="flex flex-wrap gap-1.5">
              <Chip>classification (automatic) · {facetLabel(profile.candidate_type)}</Chip>
              <Chip>
                identity {profile.identity_status} ·{" "}
                {profile.identity_rules.map((r) => r.replace(/_/g, " ")).join(" + ")}
              </Chip>
              <Chip>id {profile.candidate_id}</Chip>
            </div>
            <div>
              <div className="vr-eyebrow mb-2 !text-[10px]">
                Names this capsid appears under
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                <li>
                  <span className="vr-num text-vr-ink">{profile.canonical_name}</span>{" "}
                  {canonicalCount !== undefined ? (
                    <span className="vr-num text-vr-faint">×{canonicalCount}</span>
                  ) : null}{" "}
                  <span className="text-[11px] text-vr-faint">canonical</span>
                </li>
                {otherAliases.map((a) => (
                  <li key={a.surface}>
                    <span className="vr-num text-vr-muted">{a.surface}</span>{" "}
                    <span className="vr-num text-vr-faint">×{a.relation_count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] leading-5 text-vr-faint">
                Numbers count findings in which the capsid was written this way.
              </p>
            </div>
            <p className="text-[12px] leading-5 text-vr-faint">
              Names are matched by spelling and a small reviewed list of aliases.
              Pseudotypes, mutants, cargo variants and derivatives are separate
              profiles, and no lineage is inferred. The capsid type is the
              automatic classification, carried through unchanged.
            </p>
          </div>
        </details>
      </section>

      <AtAGlance profile={profile} current={current} llmCount={llmRelations.length} />

      <nav aria-label="Sections of this profile" className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
        <a href="#matrix" className="vr-focus text-vr-muted hover:text-vr-accent">Where evidence exists</a>
        <a href="#outcomes" className="vr-focus text-vr-muted hover:text-vr-accent">Topics</a>
        <a href="#routes" className="vr-focus text-vr-muted hover:text-vr-accent">Routes</a>
        <a href="#ledger" className="vr-focus text-vr-muted hover:text-vr-accent">Evidence &amp; sources</a>
        {llmRelations.length > 0 ? (
          <a href="#ai-extracted" className="vr-focus text-vr-muted hover:text-vr-accent">AI-extracted ({llmRelations.length})</a>
        ) : null}
        <a href="#papers" className="vr-focus text-vr-muted hover:text-vr-accent">Publications</a>
      </nav>

      <div className="mt-5">
        <EvidenceKey />
      </div>

      {/* ------------------------------------------------ 01 evidence matrix */}
      <section className="mt-10">
        <SectionHeading
          id="matrix"
          eyebrow="01 · Evidence matrix"
          title="Where evidence exists: tissue × experimental model"
          aside={<Derived n={total} />}
        />
        {total <= 3 ? (
          <div className="mb-4 rounded-[8px] border border-vr-line-strong bg-vr-surface px-4 py-3 text-[13px] leading-6 text-vr-muted">
            <span className="text-vr-ink">Thin evidence.</span> This profile
            rests on {plural(total, "extracted finding")}. That reflects what
            was published and captured from abstracts, not a property of the
            capsid. Related variants, pseudotypes and spellings are separate
            profiles.
          </div>
        ) : null}
        <div className="vr-panel p-5">
          <EvidenceMatrix
            matrix={matrix}
            candidateId={profile.candidate_id}
            filter={filter}
          />
        </div>
      </section>

      {/* ------------------------------------------------ 02 outcome evidence */}
      <section className="mt-14">
        <SectionHeading
          id="outcomes"
          eyebrow="02 · Evidence topics"
          title="What was studied, and the directions reported"
          aside={
            <span className="font-vr-mono text-[11px] text-vr-faint">
              from {plural(total, "finding")}
            </span>
          }
        />
        <div className="vr-panel overflow-x-auto p-5">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="vr-eyebrow pb-2 font-normal">topic</th>
                {presentDirections.map((d) => (
                  <th
                    key={d}
                    className="pb-2 text-center text-[12px] font-normal text-vr-muted"
                  >
                    {directionLabel(d)}
                  </th>
                ))}
                <th className="vr-eyebrow pb-2 text-right font-normal">total</th>
              </tr>
            </thead>
            <tbody>
              {outcomeTypes.map(({ type, row, total: rowTotal }) => (
                <tr key={type}>
                  <td className="pr-4">
                    <Link
                      href={dossierHref(profile.candidate_id, current, {
                        outcome: type,
                        direction: undefined,
                        limit: undefined,
                      })}
                      className="vr-focus text-vr-ink underline-offset-4 hover:underline"
                    >
                      {outcomeLabel(type)}
                    </Link>
                    {mixed.has(type) ? (
                      <span
                        className="ml-2 align-middle"
                        title="Aggregation flag: reported directions differ for this outcome type. The flag ignores context, so the papers may simply differ in tissue, model or dose. Shown, not resolved."
                      >
                        <Chip>directions differ</Chip>
                      </span>
                    ) : null}
                  </td>
                  {presentDirections.map((d) => {
                    const n = row[d] ?? 0;
                    return (
                      <td key={d} className="text-center">
                        {n > 0 ? (
                          <Link
                            href={dossierHref(profile.candidate_id, current, {
                              outcome: type,
                              direction: d,
                              limit: undefined,
                            })}
                            className={`vr-focus vr-num inline-block min-w-[44px] rounded-[4px] border border-vr-line-strong px-2 py-1 text-vr-ink hover:border-vr-accent ${
                              d === NOT_STATED ? "vr-hatch" : "bg-vr-raised"
                            }`}
                          >
                            {n}
                          </Link>
                        ) : (
                          <span className="vr-num text-vr-faint">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="vr-num text-right text-vr-muted">{rowTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 max-w-[760px] text-[12px] leading-5 text-vr-faint">
            A direction is the change a publication reports for the measured
            topic (for example, a higher or lower immune response). It is not
            a good or bad verdict. Different publications may report different
            directions in different tissues, models or doses; they are shown
            side by side and never averaged. “Directions differ” ignores
            context, so it marks a place to look, not a contradiction.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------ 03 routes */}
      <section className="mt-14">
        <SectionHeading
          id="routes"
          eyebrow="03 · Administration routes"
          title="How the vector was delivered, where stated"
          aside={<Derived n={total} />}
        />
        <div className="vr-panel p-5">
          <ul className="space-y-2.5">
            {[
              ...profile.routes.map((r) => ({ value: r.value, n: r.relation_count })),
              {
                value: NOT_STATED,
                n: evidence.filter((r) => r.route === null).length,
              },
            ]
              .filter((r) => r.n > 0)
              .sort((a, b) => {
                if (a.value === NOT_STATED) return 1;
                if (b.value === NOT_STATED) return -1;
                return b.n - a.n || a.value.localeCompare(b.value);
              })
              .map((r) => (
                <li key={r.value}>
                  <Link
                    href={dossierHref(profile.candidate_id, current, {
                      route: r.value,
                      limit: undefined,
                    })}
                    className="vr-focus group grid grid-cols-[minmax(120px,200px)_1fr_48px] items-center gap-3 text-[13px]"
                  >
                    <span
                      className={
                        r.value === NOT_STATED
                          ? "text-vr-muted"
                          : "text-vr-ink group-hover:underline"
                      }
                    >
                      {r.value === NOT_STATED ? <NotStated /> : facetLabel(r.value)}
                    </span>
                    <span className="h-2 overflow-hidden rounded-[2px] bg-vr-line">
                      <span
                        className={`block h-full ${r.value === NOT_STATED ? "vr-hatch" : "bg-vr-accent"}`}
                        style={{ width: `${(r.n / total) * 100}%` }}
                      />
                    </span>
                    <span className="vr-num text-right text-vr-muted">{r.n}</span>
                  </Link>
                </li>
              ))}
          </ul>
          <p className="mt-4 text-[12px] leading-5 text-vr-faint">
            Route values are shown as extracted, so near-duplicates such as
            “intravenous” and “intravenous/systemic” are separate rows.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------- 04 ledger */}
      <section className="mt-14">
        <SectionHeading
          id="ledger"
          eyebrow="04 · Supporting evidence"
          title="The findings behind every number"
          aside={
            <span className="vr-num text-[12px] text-vr-muted">
              {filtered.length === total
                ? plural(total, "finding")
                : `${filtered.length} of ${plural(total, "finding")}`}
            </span>
          }
        />

        {activeFilters.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-vr-faint">Filtered by</span>
            {activeFilters.map(([name, value]) => (
              <Link
                key={name}
                href={dossierHref(profile.candidate_id, current, {
                  [filterKey[name]]: undefined,
                  limit: undefined,
                })}
                className="vr-focus inline-flex items-center gap-2 rounded-[6px] border border-vr-accent-dim px-2 py-1 text-[12px] hover:bg-vr-raised"
              >
                <span className="vr-eyebrow !text-[10px]">{name}</span>
                <span className="text-vr-accent">
                  {name === "paper"
                    ? `PMID ${value}`
                    : name === "outcome"
                      ? outcomeLabel(value)
                      : name === "direction"
                        ? directionLabel(value)
                        : facetLabel(value)}
                </span>
                <span className="text-vr-faint">×</span>
              </Link>
            ))}
            <TextLink
              href={dossierHref(profile.candidate_id, {}, {}, "ledger")}
              className="text-[12px]"
            >
              clear all
            </TextLink>
          </div>
        ) : null}

        {ledger.length === 0 ? (
          <div className="vr-panel p-6 text-[13px] text-vr-muted">
            No finding matches these filters.
          </div>
        ) : (
          <div className="space-y-3">
            {ledger.slice(0, limit).map((relation) => (
              <EvidenceCard
                key={relation.relation_ref}
                relation={relation}
                paper={papers.get(relation.pmid)}
              />
            ))}
          </div>
        )}

        {ledger.length > limit ? (
          <div className="mt-5 text-center">
            <TextLink
              href={dossierHref(profile.candidate_id, current, {
                limit: String(limit + LEDGER_PAGE * 2),
              })}
            >
              Show {Math.min(LEDGER_PAGE * 2, ledger.length - limit)} more of{" "}
              {ledger.length - limit}
            </TextLink>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------- AI-extracted (experimental) */}
      {llmRelations.length > 0 ? (
        <section className="mt-14">
          <SectionHeading
            id="ai-extracted"
            eyebrow="Experimental · AI-extracted evidence"
            title="Findings extracted by a language model"
            aside={
              <span className="vr-num text-[12px] text-vr-muted">
                {plural(llmRelations.length, "finding")}
              </span>
            }
          />
          <p className="mb-4 max-w-[760px] text-[13px] leading-6 text-vr-muted">
            {loadLlmEvidence()?.caveat} These are shown beside, and never merged
            with, the rule-based evidence above.
          </p>
          <div className="space-y-3">
            {llmRelations.map((relation) => (
              <LlmEvidenceCard
                key={relation.relation_ref}
                relation={relation}
                paper={papers.get(relation.pmid)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------- 05 papers */}
      <section className="mt-14">
        <SectionHeading
          id="papers"
          eyebrow="05 · Publications"
          title="Publications are evidence sources, not capsids"
          aside={
            <span className="vr-num text-[12px] text-vr-muted">
              {paperRows.length} publications
            </span>
          }
        />
        <div className="vr-panel">
          <ul>
            {paperRows.slice(0, 12).map(({ pmid, rels, paper }) => (
              <PaperRow
                key={pmid}
                pmid={pmid}
                count={rels.length}
                title={paper?.title}
                meta={[paper?.journal, paper?.year].filter(Boolean).join(" · ")}
                href={dossierHref(profile.candidate_id, current, {
                  pmid,
                  limit: undefined,
                })}
              />
            ))}
          </ul>
          {paperRows.length > 12 ? (
            <details>
              <summary className="border-t border-vr-line px-5 py-3 text-[13px] text-vr-accent">
                Show all {paperRows.length} publications
              </summary>
              <ul>
                {paperRows.slice(12).map(({ pmid, rels, paper }) => (
                  <PaperRow
                    key={pmid}
                    pmid={pmid}
                    count={rels.length}
                    title={paper?.title}
                    meta={[paper?.journal, paper?.year].filter(Boolean).join(" · ")}
                    href={dossierHref(profile.candidate_id, current, {
                      pmid,
                      limit: undefined,
                    })}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------- coverage & missingness (folded) */}
      <section className="mt-14">
        <details className="vr-panel group">
          <summary className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4">
            <span className="text-[14px] text-vr-ink">What is and is not reported</span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-vr-faint">
              {facetInfo.map((f) => (
                <span key={f.facet} className="flex items-center gap-1.5">
                  <NotStated label={f.facet} />
                  <span className="vr-num text-vr-muted">{f.notStated}</span>
                </span>
              ))}
              <span className="text-vr-muted group-open:hidden">+</span>
              <span className="hidden text-vr-muted group-open:inline">−</span>
            </span>
          </summary>
          <div className="space-y-5 border-t border-vr-line p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              {facetInfo.map(({ facet, entries, notStated, stated }) => (
                <div key={facet} className="rounded-[8px] border border-vr-line p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium">{FACET_NAME[facet]}</span>
                    <span className="vr-num text-[12px] text-vr-muted">
                      {stated} / {total} reported
                    </span>
                  </div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-[2px] bg-vr-line">
                    <div
                      className="bg-vr-accent"
                      style={{ width: `${(stated / total) * 100}%` }}
                    />
                    <div
                      className="vr-hatch"
                      style={{ width: `${(notStated / total) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-vr-faint">
                    <NotStated />
                    <span className="vr-num">{notStated}</span>{" "}
                    {notStated === 1 ? "finding does" : "findings do"} not report
                    a {facet} in the available abstract
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {entries.slice(0, 5).map((e) => (
                      <li key={e.value}>
                        <Link
                          href={dossierHref(profile.candidate_id, current, {
                            [facet]: e.value,
                            limit: undefined,
                          })}
                          className="vr-focus"
                        >
                          <Chip>
                            {facetLabel(e.value)}{" "}
                            <span className="text-vr-ink">{e.relation_count}</span>
                          </Chip>
                        </Link>
                      </li>
                    ))}
                    {entries.length > 5 ? <Chip>+{entries.length - 5} more</Chip> : null}
                  </ul>
                </div>
              ))}
            </div>
            <div className="rounded-[8px] border border-vr-line p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[13px] font-medium">
                  Extracted directions, all outcomes
                </span>
                <Derived n={total} />
              </div>
              <DirectionStrip counts={directions} />
            </div>
          </div>
        </details>
      </section>

      {/* ----------------------------------------------------- caveat */}
      <section className="mt-10">
        <div className="rounded-[10px] border border-vr-line-strong bg-vr-surface p-6">
          <div className="vr-eyebrow">Permanent caveat</div>
          <h2 className="vr-display mt-1 text-[20px] font-semibold">
            What this profile does not say
          </h2>
          <ul className="mt-4 grid gap-x-10 gap-y-2.5 text-[13px] leading-6 text-vr-muted md:grid-cols-2">
            <li>It does not say how well this vector performs, or that it is suitable for any use.</li>
            <li>Counts reflect how much was published and extracted, not effect size or quality. Widely studied serotypes simply accumulate more.</li>
            <li>Extraction is automatic and unvalidated. Its accuracy is known only on an LLM-assisted 30-paper development pilot (precision 0.52, recall 0.81), not on held-out data.</li>
            <li>Evidence comes from abstracts. Something absent here may appear in a full text.</li>
            <li>“Not reported” means the available abstract did not say. It is not a negative finding.</li>
            <li>Hedged or prospective sentences (“may”, “could”, “holds promise”) can be recorded as an observed direction. Read the supporting sentence before relying on a count.</li>
            <li>A direction describes a reported change, not a good or bad outcome. Opposing directions may reflect different tissues, models or doses.</li>
            <li>Names are matched by spelling and a small alias list. Related variants are separate profiles and no parentage is inferred.</li>
          </ul>
          <p className="mt-4 border-t border-vr-line pt-3 text-[12px] leading-5 text-vr-faint">
            Profile data come from{" "}
            <span className="vr-num">vectorank.candidate_profiles.v1</span>.
            Counts on this page (matrix cells, reported / not reported, route bars) are
            plain group-by counts over this capsid’s own findings.
          </p>
        </div>
      </section>
    </Shell>
  );
}

function PaperRow({
  pmid,
  count,
  title,
  meta,
  href,
}: {
  pmid: string;
  count: number;
  title?: string;
  meta: string;
  href: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-vr-line px-5 py-3 first:border-t-0">
      <div className="min-w-0 max-w-[820px]">
        <div className="text-[13px] leading-5 text-vr-ink">
          {title || "Title not recorded"}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-vr-faint">
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="vr-focus vr-num text-vr-accent underline-offset-4 hover:underline"
          >
            PMID {pmid} ↗
          </a>
          {meta ? <span>{meta}</span> : <NotStated label="journal / year not recorded" />}
        </div>
      </div>
      <Link
        href={href}
        className="vr-focus vr-num whitespace-nowrap text-[12px] text-vr-muted hover:text-vr-ink"
      >
        {count} finding{count === 1 ? "" : "s"} →
      </Link>
    </li>
  );
}


// An AI-discovered capsid whose source sentences state no tissue, model or route:
// the identity and where it is named are shown; no outcome, direction or
// characteristic is, because none is established by a name alone.
function DiscoveredIdentityOnly({
  profile,
  papers,
}: {
  profile: CandidateProfile;
  papers: Map<string, Paper>;
}) {
  const d = profile.discovery!;
  return (
    <Shell active="candidate">
      <TextLink href="/results" className="text-[13px]">
        ← Candidates
      </TextLink>
      <section className="mt-5">
        <div className="vr-eyebrow">Candidate profile · minimal</div>
        <h1 className="vr-display mt-3 break-words text-[48px] font-semibold leading-none text-vr-ink sm:text-[64px]">
          {profile.canonical_name}
        </h1>
        <div className="mt-5 rounded-[8px] border border-[#5a4a22] bg-[#d2b36a0d] px-4 py-3 text-[13px] leading-6 text-vr-note">
          <span className="font-medium">{d.label}.</span>{" "}
          {loadLlmEvidence()?.discovery_caveat}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading
          eyebrow="Characteristics"
          title="None established yet"
        />
        <p className="max-w-[760px] text-[13px] leading-6 text-vr-muted">
          Tissue, model, route and outcome are <NotStated /> for this capsid.
          The source sentence below does not state a tissue, a species or a
          route, so no result is shown as a claim: a name alone does not
          establish performance. Nothing here ranks or recommends the capsid.
        </p>
      </section>

      <section className="mt-10">
        <SectionHeading
          eyebrow="Source"
          title="Where this capsid is named"
        />
        <div className="space-y-3">
          {d.identity_sources.map((src) => {
            const paper = papers.get(src.pmid);
            return (
              <article key={src.relation_ref} className="vr-panel p-4">
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="vr-focus vr-num text-[13px] text-vr-accent underline-offset-4 hover:underline"
                >
                  PMID {src.pmid} ↗
                </a>
                <div className="mt-1 text-[13px] leading-5 text-vr-muted">
                  {paper?.title ?? "Title not recorded"}
                  <span className="text-vr-faint">
                    {" "}
                    — {[paper?.journal, paper?.year].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {src.excerpt !== null ? (
                  <>
                    <blockquote className="mt-3 border-l-2 border-vr-accent-dim pl-3 text-[14px] leading-6 text-vr-ink">
                      {src.excerpt}
                    </blockquote>
                    {paper?.attribution ? (
                      <p className="mt-1.5 text-[11px] leading-5 text-vr-faint">
                        {paper.attribution}{" "}
                        <a
                          href={paper.license_source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="vr-focus underline-offset-4 hover:underline"
                        >
                          Licence record ↗
                        </a>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 border-l-2 border-vr-line-strong pl-3 text-[13px] text-vr-muted">
                    Source sentence not reproduced here (no verified open
                    licence). Read it on PubMed above.
                  </p>
                )}
                <div className="mt-1.5 text-[12px] text-vr-faint">
                  Written as{" "}
                  <span className="vr-num text-vr-muted">{src.surface_candidate}</span>
                  . AI-extracted, not reviewed by a person.
                  {src.shared_claim_with.length > 0
                    ? ` This sentence also names ${src.shared_claim_with.join(", ")}.`
                    : ""}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}
