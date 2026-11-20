import { toQuery, type EvidenceFilter } from "./context";

export type DossierParams = EvidenceFilter & { limit?: string };

// Link into a candidate dossier. Filters live in the URL so a view can be
// shared; passing `undefined` for a key removes it.
export function dossierHref(
  candidateId: string,
  current: DossierParams,
  overrides: Partial<Record<keyof DossierParams, string | undefined>> = {},
  hash: string | null = "ledger",
): string {
  const merged: Record<string, string | undefined> = { ...current };
  for (const [key, value] of Object.entries(overrides)) merged[key] = value;
  const base = `/candidate/${encodeURIComponent(candidateId)}${toQuery(merged)}`;
  return hash ? `${base}#${hash}` : base;
}
