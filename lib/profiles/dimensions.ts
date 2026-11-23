// The structure of a Results row, and the one place future dimensions plug in.
//
// A row has three zones:
//   1. Identity               who the candidate is
//   2. Evidence profile       descriptive counts over extracted relations
//   3. Prioritization         RESERVED. Nothing is rendered here today.
//
// VectoRank has no validated prioritization model. A dimension such as
// biological fit, evidence confidence, translational relevance, safety evidence
// or manufacturing evidence may only be registered in PRIORITIZATION_DIMENSIONS
// once it exists, is validated, and has a stated source. Registering one adds
// a zone to every row and (if `sortable`) an entry to the Order by control; no
// other part of the page needs to change. Until then the list is empty on
// purpose, and the zone, its grid column and its header cell are all omitted.

export type ResultOrder = "volume" | "name";

export type OrderOption = {
  id: ResultOrder;
  label: string;
  // The sentence shown under the Results header while this order is active.
  statement: string;
};

// Only descriptive dimensions the current data supports. No relevance, quality,
// confidence, suitability or recommendation ordering exists.
export const ORDER_OPTIONS: OrderOption[] = [
  {
    id: "volume",
    label: "Matching evidence volume",
    statement: "Ordered by matching evidence volume, not suitability.",
  },
  {
    id: "name",
    label: "Name A–Z",
    statement:
      "Ordered by candidate name. VectoRank does not rank candidates by suitability.",
  },
];

export const DEFAULT_ORDER: ResultOrder = "volume";

export function parseOrder(value: string | string[] | undefined): ResultOrder {
  const raw = Array.isArray(value) ? value[0] : value;
  return ORDER_OPTIONS.some((o) => o.id === raw) ? (raw as ResultOrder) : DEFAULT_ORDER;
}

export type PrioritizationDimension = {
  id: string;
  label: string;
  kind: "model-derived";
  validated: true; // a dimension may not be registered until it is validated
  source: string; // what it is computed from, shown to the user
  sortable: boolean;
};

// Reserved and intentionally empty.
export const PRIORITIZATION_DIMENSIONS: PrioritizationDimension[] = [];

// Fixed outcome-category slots, in a fixed order, so that a column can be read
// down the list. Labels are the extractor's outcome categories; a count means
// "matching relations carrying this category" and implies nothing about
// direction or result.
export const OUTCOME_SLOTS: { key: string; short: string; label: string }[] = [
  { key: "transduction_expression", short: "TRN", label: "Transduction / expression" },
  { key: "efficacy", short: "EFF", label: "Efficacy" },
  { key: "safety", short: "SAF", label: "Safety" },
  { key: "immune", short: "IMM", label: "Immune response" },
  { key: "durability", short: "DUR", label: "Durability" },
  { key: "manufacturing", short: "MFG", label: "Manufacturing" },
  { key: "mechanism", short: "MEC", label: "Mechanism" },
];
