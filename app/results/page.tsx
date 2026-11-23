"use client";

import { withBase } from "@/lib/base";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toParams } from "@/lib/profiles/params";
import DataGate from "../_ui/DataGate";
import { RememberResults } from "../_ui/BackToResults";
import Link from "next/link";
import EvidenceKey from "../_ui/EvidenceKey";
import { loadProfiles } from "@/lib/profiles/load";
import {
  FACETS,
  facetLabel,
  parseContext,
  searchCandidates,
  toQuery,
  type CandidateResult,
} from "@/lib/profiles/context";
import { dossierHref } from "@/lib/profiles/links";
import { Shell } from "../_ui/chrome";
import { NotStated, TextLink } from "../_ui/atoms";
import CandidateCard from "../_ui/CandidateCard";
import {
  DEFAULT_ORDER,
  ORDER_OPTIONS,
  parseOrder,
} from "@/lib/profiles/dimensions";

// Screen 2: candidates, not papers. The order is the amount of matching
// evidence and nothing else; it is not a quality, fit or suitability ordering.

const PAGE = 20;

function CompactRow({
  result,
  ctx,
  note,
}: {
  result: CandidateResult;
  ctx: ReturnType<typeof parseContext>;
  note: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-vr-line py-2.5 last:border-b-0">
      <Link
        href={dossierHref(result.profile.candidate_id, ctx, {}, null)}
        className="vr-focus text-[14px] text-vr-ink underline-offset-4 hover:underline"
      >
        {result.profile.canonical_name}
      </Link>
      <span className="text-[12px] text-vr-faint">{note}</span>
    </li>
  );
}

function ResultsView() {
  const params = toParams(useSearchParams());
  const artifact = loadProfiles();
  const ctx = parseContext(params);
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const shown = Math.max(
    PAGE,
    Math.min(Number(typeof params.n === "string" ? params.n : PAGE) || PAGE, 400),
  );

  const order = parseOrder(params.order);
  const outcome = searchCandidates(artifact, ctx, q || undefined, order);
  const selected = FACETS.filter((f) => ctx[f]);
  const hasLens = selected.length > 0;

  // One continuous result set. Candidates are not split into evidence tiers:
  // a paper count is shown on every row but never used to group them.
  const main = outcome.matches;
  const visible = main.slice(0, shown);
  const allMatching = outcome.matches.concat(outcome.review);
  const matchingRelations = allMatching.reduce(
    (n, r) => n + r.summary.matching.length,
    0,
  );
  const matchingPapers = new Set(
    allMatching.flatMap((r) => r.summary.matching.map((m) => m.pmid)),
  ).size;

  const editHref = `/search${toQuery({ ...ctx, q: q || undefined })}`;
  const orderHref = (id: string) =>
    `/results${toQuery({ ...ctx, q: q || undefined, order: id === DEFAULT_ORDER ? undefined : id })}`;
  const statement = ORDER_OPTIONS.find((o) => o.id === order)!.statement;

  return (
    <Shell active="results">
      <RememberResults />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <div className="vr-eyebrow">Search results</div>
          <h1 className="vr-display mt-2 text-[32px] font-semibold">
            {allMatching.length}{" "}
            <span className="text-vr-muted">
              capsid{allMatching.length === 1 ? "" : "s"}{" "}
              {hasLens || q ? "match your search" : "with documented evidence"}
            </span>
          </h1>
          <p className="mt-2 text-[13px] text-vr-muted">
            <span className="vr-num text-vr-ink">{matchingRelations}</span> extracted findings from{" "}
            <span className="vr-num text-vr-ink">{matchingPapers}</span> scientific publications
          </p>
        </div>
        <TextLink href={editHref} className="text-[13px]">
          ← New search
        </TextLink>
      </div>

      <form action={withBase("/results")} method="get" role="search" className="mt-5 flex max-w-[520px] gap-2">
        {FACETS.map((f) =>
          ctx[f] ? <input key={f} type="hidden" name={f} value={ctx[f]!} /> : null,
        )}
        <label htmlFor="rq" className="sr-only">
          Search a capsid by name or alias
        </label>
        <input
          id="rq"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search a capsid by name or alias"
          className="vr-focus min-w-0 flex-1 rounded-[8px] border border-vr-line-strong bg-vr-surface px-3.5 py-2.5 text-[14px] text-vr-ink placeholder:text-vr-faint hover:border-vr-faint"
        />
        <button
          type="submit"
          className="vr-focus rounded-[8px] border border-vr-line-strong px-4 py-2.5 text-[14px] text-vr-ink transition-colors hover:border-vr-accent hover:text-vr-accent"
        >
          Search
        </button>
      </form>

      {selected.length > 0 || q ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-vr-faint">Active filters:</span>
            {q ? (
              <span className="inline-flex items-center gap-2 rounded-[6px] border border-vr-accent-dim px-2.5 py-1.5 text-[12px]">
                <span className="vr-eyebrow !text-[10px]">name</span>
                <span className="text-vr-accent">{q}</span>
                <Link
                  href={`/results${toQuery({ ...ctx })}`}
                  aria-label={`Remove name filter ${q}`}
                  className="vr-focus text-vr-faint hover:text-vr-ink"
                >
                  ×
                </Link>
              </span>
            ) : null}
            {selected.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-2 rounded-[6px] border border-vr-line-strong px-2.5 py-1.5 text-[12px]"
              >
                <span className="vr-eyebrow !text-[10px]">{f === "model" ? "model / species" : f === "route" ? "delivery route" : f}</span>
                <span className="text-vr-ink">{facetLabel(ctx[f]!)}</span>
                <Link
                  href={`/results${toQuery({ ...ctx, [f]: undefined, q: q || undefined })}`}
                  aria-label={`Remove ${f} filter ${facetLabel(ctx[f]!)}`}
                  className="vr-focus text-vr-faint hover:text-vr-ink"
                >
                  ×
                </Link>
              </span>
            ))}
            <Link href="/results" className="vr-focus ml-1 text-[12px] text-vr-accent underline-offset-4 hover:underline">
              Clear all
            </Link>
          </div>
          {hasLens ? (
            <p className="mt-2 max-w-[760px] text-[12px] leading-5 text-vr-faint">
              A finding counts as a match only when its abstract states the selected{" "}
              {selected.map((f) => (f === "model" ? "model" : f === "route" ? "route" : f)).join(", ")}. Findings that do not
              report it are listed separately below and are never counted as matches or as negative results.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <p className="text-[13px] text-vr-muted">
          <span className="font-medium text-vr-ink">{statement}</span>{" "}
          <span className="text-vr-faint">This is not a ranking of quality or suitability.</span>
        </p>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-vr-faint">Order by</span>
          <div
            role="group"
            aria-label="Order by"
            className="inline-flex overflow-hidden rounded-[8px] border border-vr-line-strong"
          >
            {ORDER_OPTIONS.map((option) => (
              <Link
                key={option.id}
                href={orderHref(option.id)}
                aria-current={option.id === order ? "true" : undefined}
                className={`vr-focus px-3 py-1.5 transition-colors ${
                  option.id === order
                    ? "bg-vr-raised text-vr-ink"
                    : "text-vr-muted hover:text-vr-ink"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {hasLens && outcome.unknownOnly.length > 0 ? (
        <p className="mt-4 text-[13px] leading-6 text-vr-muted">
          <NotStated /> A further{" "}
          <span className="vr-num text-vr-ink">{outcome.unknownOnly.length}</span>{" "}
          capsids have no matching finding, but have findings whose abstract does not report the selected context. That
          is unknown, not evidence that the capsid failed.
        </p>
      ) : null}

      {allMatching.length === 0 ? (
        <div className="vr-panel mt-8 p-8 text-center">
          <p className="text-[15px] text-vr-ink">No capsid has a finding matching this search.</p>
          <p className="mx-auto mt-2 max-w-[560px] text-[13px] leading-6 text-vr-muted">
            That means this collection holds no such finding, not that the capsid was tested and failed. Try a
            different spelling or alias, remove a filter (delivery route is the least often reported), or start
            again.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]">
            <TextLink href="/results">Clear all filters</TextLink>
            <TextLink href={editHref}>Change search</TextLink>
            {["AAV9", "AAV-PHP.B", "MC5", "BAAV"].map((n) => (
              <TextLink key={n} href={`/results?q=${encodeURIComponent(n)}`}>
                Try {n}
              </TextLink>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 text-[12px] leading-5 text-vr-faint">
            Each number counts findings extracted from published abstracts. A count says how much was reported, not how
            well a capsid performs: 40 transduction findings is not 40% transduction.
          </p>
          <ul className="space-y-2.5">
            {visible.map((result) => (
              <li key={result.profile.candidate_id}>
                <CandidateCard result={result} ctx={ctx} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {main.length > shown ? (
        <div className="mt-6 text-center">
          <TextLink
            href={`/results${toQuery({ ...ctx, q: q || undefined, order: order === DEFAULT_ORDER ? undefined : order, n: String(shown + PAGE) })}`}
          >
            Show {Math.min(PAGE, main.length - shown)} more of {main.length - shown}
          </TextLink>
        </div>
      ) : null}

      <div className="mt-10 space-y-3">
        <EvidenceKey />
        {outcome.review.length > 0 ? (
          <details className="vr-panel">
            <summary className="flex items-center justify-between px-5 py-3.5 text-[14px] text-vr-ink">
              <span>
                Names under review{" "}
                <span className="vr-num text-vr-muted">({outcome.review.length})</span>
              </span>
              <span className="text-[12px] text-vr-faint">
                look like sentence fragments, not capsid names
              </span>
            </summary>
            <div className="px-5 pb-4">
              <p className="mb-2 text-[12px] leading-5 text-vr-faint">
                These entries are kept out of the main list and are not merged or renamed. They stay here until the
                extraction improves.
              </p>
              <ul>
                {outcome.review.map((r) => (
                  <CompactRow
                    key={r.profile.candidate_id}
                    result={r}
                    ctx={ctx}
                    note={`${r.summary.matching.length} relation${r.summary.matching.length === 1 ? "" : "s"} · ${r.review}`}
                  />
                ))}
              </ul>
            </div>
          </details>
        ) : null}

        {outcome.unknownOnly.length > 0 ? (
          <details className="vr-panel">
            <summary className="flex items-center justify-between px-5 py-3.5 text-[14px] text-vr-ink">
              <span>
                No match, context not reported{" "}
                <span className="vr-num text-vr-muted">
                  ({outcome.unknownOnly.length})
                </span>
              </span>
              <span className="text-[12px] text-vr-faint">
                unknown, not evidence of absence
              </span>
            </summary>
            <ul className="px-5 pb-3">
              {outcome.unknownOnly.slice(0, 60).map((r) => (
                <CompactRow
                  key={r.profile.candidate_id}
                  result={r}
                  ctx={ctx}
                  note={`${r.summary.unknownCompatible} of ${r.summary.total} findings do not report the selected context`}
                />
              ))}
            </ul>
            {outcome.unknownOnly.length > 60 ? (
              <p className="px-5 pb-4 text-[12px] text-vr-faint">
                Showing 60 of {outcome.unknownOnly.length}, by unknown-relation count.
              </p>
            ) : null}
          </details>
        ) : null}

        <details className="vr-panel">
          <summary className="flex items-center justify-between px-5 py-3.5 text-[14px] text-vr-ink">
            <span>Mentions not assigned to a capsid</span>
            <span className="text-[12px] text-vr-faint">
              <span className="vr-num">{artifact.counts.mentions_generic}</span>{" "}
              generic ·{" "}
              <span className="vr-num">{artifact.counts.mentions_unresolved}</span>{" "}
              unresolved ·{" "}
              <span className="vr-num">{artifact.counts.mentions_non_candidate}</span>{" "}
              other mentions
            </span>
          </summary>
          <div className="grid gap-6 px-5 pb-5 md:grid-cols-3">
            {(
              [
                ["Generic", "a class of vectors, not one capsid", artifact.generic_mentions],
                ["Unresolved", "a name the text does not identify", artifact.unresolved_mentions],
                ["Not a capsid", "a known entity that is not an AAV capsid", artifact.non_candidate_mentions],
              ] as const
            ).map(([title, sub, rows]) => (
              <div key={title}>
                <div className="text-[13px] text-vr-ink">{title}</div>
                <div className="mb-2 text-[12px] text-vr-faint">{sub}</div>
                <ul className="space-y-1">
                  {rows.slice(0, 8).map((m) => (
                    <li
                      key={m.surface}
                      className="flex items-baseline justify-between gap-3 text-[12px]"
                    >
                      <span className="vr-num truncate text-vr-muted">{m.surface}</span>
                      <span className="vr-num text-vr-faint">{m.relation_count}</span>
                    </li>
                  ))}
                  {rows.length > 8 ? (
                    <li className="text-[12px] text-vr-faint">
                      + {rows.length - 8} more surface forms
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
          <p className="px-5 pb-4 text-[12px] leading-5 text-vr-faint">
            These mentions are kept with their PubMed IDs. They are not dropped, and not guessed into a nearby capsid.
          </p>
        </details>
      </div>

    </Shell>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <DataGate>
        <ResultsView />
      </DataGate>
    </Suspense>
  );
}
