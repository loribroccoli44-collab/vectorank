import Link from "next/link";
import type { ReactNode } from "react";

export const PILOT_CAVEAT =
  "Research-stage Beta. Rule-based and AI-extracted evidence come from abstracts and are not independently validated. The rule-based extractor was measured only on a 30-paper development set (precision 0.52, recall 0.81), not on held-out data, and the AI extraction has not been measured. Counts describe evidence found in this corpus, not biological performance, and nothing here ranks or predicts capsids.";

// One brand, used by the landing page and the platform alike.
export function Brand() {
  return (
    <Link href="/" className="vr-focus flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-vr-accent-dim bg-[#36cdb914] text-vr-accent">
        <span className="material-symbols-outlined text-[18px]">biotech</span>
      </span>
      <span className="vr-display text-[18px] font-bold">VectoRank</span>
    </Link>
  );
}

type NavProps =
  | { variant: "landing" }
  | { variant: "platform"; active?: "search" | "results" | "candidate" | "about" };

export function SiteNav(props: NavProps) {
  const link = (href: string, label: string, on = false) => (
    <Link
      key={href}
      href={href}
      className={`vr-focus rounded-[6px] px-2.5 py-1.5 text-[13px] transition-colors ${
        on ? "bg-vr-raised text-vr-ink" : "text-vr-muted hover:text-vr-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-vr-line bg-vr-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Brand />
          <nav className="hidden items-center gap-1 sm:flex">
            {props.variant === "landing" ? (
              <>
                {link("#workflow", "Workflow")}
                {link("#scope", "Scope")}
                {link("/about", "Methodology")}
              </>
            ) : (
              <>
                {link("/search", "Search", props.active === "search")}
                {link("/results", "Capsids", props.active === "results")}
                {link("/about", "About", props.active === "about")}
              </>
            )}
          </nav>
        </div>
        {props.variant === "landing" ? (
          <Link href="/search" className="vr-cta vr-focus px-4 py-2 text-[13px]">
            Explore evidence
          </Link>
        ) : (
          <span className="vr-eyebrow hidden md:inline">
            research-stage Beta · unvalidated extraction
          </span>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-vr-line">
      <div className="mx-auto max-w-[1240px] px-6 py-6 text-[12px] leading-5 text-vr-faint">
        {PILOT_CAVEAT}{" "}
        <Link href="/about" className="vr-focus text-vr-muted underline-offset-4 hover:underline">
          About and methodology
        </Link>
      </div>
    </footer>
  );
}

export function Shell({
  children,
  active,
}: {
  children: ReactNode;
  active?: "search" | "results" | "candidate" | "about";
}) {
  return (
    <div className="min-h-screen bg-vr-bg font-vr-sans text-vr-ink antialiased">
      <SiteNav variant="platform" active={active} />
      <main className="mx-auto max-w-[1240px] px-6 pb-24 pt-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
