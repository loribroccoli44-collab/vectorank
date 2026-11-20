import Link from "next/link";
import {
  NOT_STATED,
  facetLabel,
  outcomeLabel,
  type EvidenceFilter,
  type Matrix,
} from "@/lib/profiles/context";
import { dossierHref } from "@/lib/profiles/links";

// The Evidence Matrix: tissue x experimental model, every cell a count of real
// extracted relations. Shade follows relation count (square-root scale) and encodes
// nothing else: it is evidence volume, never efficacy or suitability. Hatched
// rows/columns are "not stated in the paper". Each cell opens the relations
// behind it: aggregate -> inspect -> source.

const ACCENT = "54, 205, 185";

function shade(count: number, max: number) {
  if (count === 0) {
    return { backgroundColor: "transparent", color: "var(--color-vr-faint)" };
  }
  const alpha = 0.14 + 0.66 * Math.sqrt(count / max);
  return {
    backgroundColor: `rgba(${ACCENT}, ${alpha.toFixed(3)})`,
    color: alpha > 0.52 ? "#03211c" : "var(--color-vr-ink)",
  };
}

const STEPS = [
  ["1", "Aggregate", "relation counts per tissue and model"],
  ["2", "Inspect", "click a cell to list the relations behind it"],
  ["3", "Source", "read the supporting text and open the PMID"],
] as const;

export default function EvidenceMatrix({
  matrix,
  candidateId,
  filter,
  compact = false,
}: {
  matrix: Matrix;
  candidateId: string;
  filter: EvidenceFilter;
  compact?: boolean;
}) {
  const href = (tissue?: string, model?: string) =>
    dossierHref(candidateId, filter, { tissue, model, limit: undefined });

  const selected = (row: string, col: string) =>
    filter.tissue === row && filter.model === col;

  const hasSelection = Boolean(
    filter.tissue || filter.model || filter.outcome || filter.direction || filter.pmid,
  );
  const cellPad = compact ? "py-1.5" : "py-2.5";

  return (
    <div>
      {!compact ? (
        <ol className="mb-5 grid gap-2 sm:grid-cols-3">
          {STEPS.map(([n, title, text]) => (
            <li
              key={n}
              className="flex items-baseline gap-3 rounded-[8px] border border-vr-line px-3 py-2"
            >
              <span className="vr-num text-[11px] text-vr-accent">{n}</span>
              <span className="text-[13px] text-vr-ink">{title}</span>
              <span className="hidden text-[12px] text-vr-faint xl:inline">
                {text}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[3px] text-[12px]">
          <caption className="sr-only">
            Relation counts by tissue (rows) and experimental model (columns)
          </caption>
          <thead>
            <tr>
              <th className={`p-1 text-left align-bottom ${compact ? "w-[92px] min-w-[84px]" : "w-[140px] min-w-[110px]"}`}>
                <span className="vr-eyebrow !text-[10px]">tissue ↓ model →</span>
              </th>
              {matrix.cols.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={`p-0 text-center align-bottom font-normal ${compact ? "min-w-[46px] text-[11px]" : "min-w-[68px]"}`}
                >
                  <Link
                    href={href(undefined, filter.model === col ? undefined : col)}
                    className={`vr-focus block rounded-[4px] ${compact ? "px-0.5" : "px-1"} py-1.5 leading-4 hover:text-vr-ink ${
                      col === NOT_STATED ? "vr-hatch text-vr-muted" : "text-vr-muted"
                    } ${filter.model === col ? "text-vr-ink ring-1 ring-vr-accent" : ""}`}
                  >
                    {facetLabel(col)}
                  </Link>
                </th>
              ))}
              <th className={`p-1 text-right align-bottom ${compact ? "w-[40px]" : "w-[52px]"}`}>
                <span className="vr-eyebrow !text-[10px]">total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row}>
                <th scope="row" className="p-0 text-left font-normal">
                  <Link
                    href={href(filter.tissue === row ? undefined : row, undefined)}
                    className={`vr-focus block rounded-[4px] ${compact ? "px-1.5" : "px-2"} ${cellPad} hover:text-vr-ink ${
                      row === NOT_STATED ? "vr-hatch text-vr-muted" : "text-vr-ink"
                    } ${filter.tissue === row ? "ring-1 ring-vr-accent" : ""}`}
                  >
                    {facetLabel(row)}
                  </Link>
                </th>
                {matrix.cols.map((col) => {
                  const n = matrix.cells[row]?.[col] ?? 0;
                  const hatched = row === NOT_STATED || col === NOT_STATED;
                  return (
                    <td key={col} className="p-0 text-center">
                      {n > 0 ? (
                        <Link
                          href={
                            selected(row, col)
                              ? href(undefined, undefined)
                              : href(row, col)
                          }
                          title={`${n} relation${n === 1 ? "" : "s"} · tissue ${facetLabel(row)} · model ${facetLabel(col)}`}
                          className={`vr-focus vr-num block rounded-[4px] ${cellPad} text-[13px] transition-[filter,transform] hover:-translate-y-px hover:brightness-125 ${
                            hatched ? "vr-hatch" : ""
                          } ${selected(row, col) ? "ring-2 ring-vr-ink" : ""}`}
                          style={shade(n, matrix.max)}
                        >
                          {n}
                        </Link>
                      ) : (
                        <span
                          className={`vr-num block rounded-[4px] border border-vr-line ${cellPad} text-vr-faint ${
                            hatched ? "vr-hatch opacity-60" : ""
                          }`}
                          title="no relations"
                        >
                          ·
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="vr-num p-1 text-right text-vr-muted">
                  {matrix.rowTotals[row]}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="p-1 text-left">
                <span className="vr-eyebrow !text-[10px]">total</span>
              </th>
              {matrix.cols.map((col) => (
                <td key={col} className="vr-num p-1 text-center text-vr-muted">
                  {matrix.colTotals[col]}
                </td>
              ))}
              <td className="vr-num p-1 text-right text-vr-ink">{matrix.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-vr-faint">
        <span className="flex items-center gap-2">
          <span>fewer relations</span>
          <span
            className="inline-block h-2 w-20 rounded-[2px]"
            style={{
              background: `linear-gradient(to right, rgba(${ACCENT},0.14), rgba(${ACCENT},0.8))`,
            }}
          />
          <span>more</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="vr-hatch inline-block h-2.5 w-4 rounded-[2px] border border-vr-line-strong" />
          not stated in the paper
        </span>
        <span>Shade shows evidence volume only, not efficacy or suitability.</span>
      </div>

      {hasSelection ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-vr-accent-dim bg-[#36cdb90d] px-4 py-3">
          <div className="text-[13px] text-vr-ink">
            Selected
            {filter.tissue ? <> · tissue <b className="font-medium">{facetLabel(filter.tissue)}</b></> : null}
            {filter.model ? <> · model <b className="font-medium">{facetLabel(filter.model)}</b></> : null}
            {filter.outcome ? <> · outcome <b className="font-medium">{outcomeLabel(filter.outcome)}</b></> : null}
            {filter.pmid ? <> · PMID <b className="vr-num font-medium">{filter.pmid}</b></> : null}
          </div>
          <div className="flex items-center gap-4 text-[13px]">
            <Link
              href={dossierHref(candidateId, filter, {}, "ledger")}
              className="vr-focus text-vr-accent underline-offset-4 hover:underline"
            >
              View these relations ↓
            </Link>
            {compact ? null : (
              <Link
                href={dossierHref(candidateId, {}, {}, "matrix")}
                className="vr-focus text-vr-muted underline-offset-4 hover:underline"
              >
                Clear
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
