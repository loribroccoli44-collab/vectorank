import { loadLlmEvidence } from "@/lib/profiles/load";
import { Chip, NotStated } from "./atoms";

// One place that says what each kind of evidence on the site means. It is a
// closed <details> so it costs nothing on first view and is one click away on
// every page that mixes kinds of evidence.

function heldBack(): number | null {
  const n = loadLlmEvidence()?.counts?.pending_or_rejected;
  return typeof n === "number" ? n : null;
}

export default function EvidenceKey() {
  const held = heldBack();
  return (
    <details className="vr-panel group">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-[14px] text-vr-ink">
        <span>How to read the evidence labels</span>
        <span className="text-vr-muted group-open:hidden">+</span>
        <span className="hidden text-vr-muted group-open:inline">−</span>
      </summary>
      <dl className="space-y-3 border-t border-vr-line px-5 py-4 text-[13px] leading-6 text-vr-muted">
        <div>
          <dt className="mb-1"><Chip>rule-based</Chip></dt>
          <dd>Extracted from abstracts by fixed text rules. Machine-extracted; no finding has been reviewed by a person.</dd>
        </div>
        <div>
          <dt className="mb-1"><Chip tone="note">AI-extracted</Chip></dt>
          <dd>
            Extracted by a language model from the same abstracts and automatically checked (the quoted sentence must occur
            in the abstract, the capsid must be named in it, effects of a treatment are not credited to the capsid). These
            checks test form, not scientific truth. <span className="text-vr-ink">Not independently validated.</span> Shown
            separately and never merged with rule-based evidence.
          </dd>
        </div>
        <div>
          <dt className="mb-1"><NotStated /></dt>
          <dd>This information was not reported in the available abstract. It is never filled in, and it is not a negative result.</dd>
        </div>
        <div>
          <dt className="mb-1"><Chip>not shown</Chip></dt>
          <dd>
            Findings the automatic checks do not show because they are ambiguous or may mislead: an effect of a treatment or immune cell,
            a capsid not named in the sentence, an identity that needs review, or a result with no reported tissue, model or
            route.{held !== null ? ` ${held.toLocaleString("en-US")} extracted findings are not shown across the AI-extracted set.` : ""}
          </dd>
        </div>
        <div>
          <dt className="mb-1"><Chip>independently validated</Chip></dt>
          <dd>None. No evidence on this site has passed an independent, human-annotated evaluation. Observations are context-dependent and are not predictions of how a capsid will perform.</dd>
        </div>
      </dl>
    </details>
  );
}
