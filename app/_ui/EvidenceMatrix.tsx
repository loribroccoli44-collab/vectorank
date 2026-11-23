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
      <p className="mb-3 max-w-[760px] text-[13px] leading-6 text-vr-muted">
        Each square shows how many findings were reported for one tissue (row) and one experimental model (column).{" "}
        <span className="text-vr-ink">Darker squares mean more published findings, not better capsid performance.</span>{" "}
        Select a square to explore the supporting studies. An empty square means nothing was extracted, not that the
        combination was tested and failed.
      </p>

      {/* Narrow screens: grouped list instead of a dense, horizontally scrolling grid. */}
      <ul className="space-y-2 md:hidden">
        {matrix.rows.map((row) => (
          <li key={row} className="rounded-[8px] border border-vr-line px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={href(filter.tissue === row ? undefined : row, undefined)}
                className={`vr-focus text-[14px] ${row === NOT_STATED ? "text-vr-muted" : "text-vr-ink"} ${filter.tissue === row ? "underline decoration-vr-accent" : ""}`}
              >
                {row === NOT_STATED ? "Tissue not reported" : facetLabel(row)}
              </Link>
              <span className="vr-num text-[12px] text-vr-faint">{matrix.rowTotals[row]} findings</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matrix.cols
                .filter((col) => (matrix.cells[row]?.[col] ?? 0) > 0)
                .map((col) => {
                  const n = matrix.cells[row][col];
                  return (
                    <Link
                      key={col}
                      href={selected(row, col) ? href(undefined, undefined) : href(row, col)}
                      className={`vr-focus vr-num rounded-[4px] border px-2 py-1 text-[12px] ${
                        selected(row, col) ? "border-vr-ink" : "border-vr-line-strong"
                      } ${row === NOT_STATED || col === NOT_STATED ? "vr-hatch" : ""}`}
                      style={shade(n, matrix.max)}
                    >
                      {col === NOT_STATED ? "model not reported" : facetLabel(col)} · {n}
                    </Link>
                  );
                })}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-[3px] text-[12px]">
          <caption className="sr-only">
            Counts of extracted findings by tissue (rows) and experimental model (columns)
          </caption>
          <thead>
            <tr>
              <th className={`p-1 text-left align-bottom ${compact ? "w-[92px] min-w-[84px]" : "w-[140px] min-w-[110px]"}`}>
                <span className="vr-eyebrow !text-[10px]">tissue ↓ · model →</span>
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
                <span className="vr-eyebrow !text-[10px]">all</span>
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
                          title={`${n} finding${n === 1 ? "" : "s"} · tissue: ${facetLabel(row)} · model: ${facetLabel(col)}. Click to see them.`}
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
                          title="No findings extracted for this combination"
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
                <span className="vr-eyebrow !text-[10px]">all</span>
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
          <span>fewer findings</span>
          <span
            className="inline-block h-2 w-20 rounded-[2px]"
            style={{
              background: `linear-gradient(to right, rgba(${ACCENT},0.14), rgba(${ACCENT},0.8))`,
            }}
          />
          <span>more findings</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="vr-hatch inline-block h-2.5 w-4 rounded-[2px] border border-vr-line-strong" />
          not reported in the abstract
        </span>
        <span>Shading shows how much was reported, not efficacy or suitability.</span>
      </div>

      {hasSelection ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-vr-accent-dim bg-[#36cdb90d] px-4 py-3">
          <div className="text-[13px] text-vr-ink">
            Showing findings for
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
              View supporting findings ↓
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
