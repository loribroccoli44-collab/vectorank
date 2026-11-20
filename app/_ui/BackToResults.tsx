"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "vr:lastResults";

// The results page records its exact URL (including a typed name search) so a
// profile can return to it. Storage may be unavailable: the filter-based
// fallback link is always rendered and always works.
export function RememberResults() {
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, location.pathname + location.search);
    } catch {
      /* storage unavailable */
    }
  }, []);
  return null;
}

export default function BackToResults({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
      <Link
        href={fallbackHref}
        onClick={(e) => {
          try {
            const last = sessionStorage.getItem(KEY);
            if (last && last.startsWith("/results")) {
              e.preventDefault();
              router.push(last);
            }
          } catch {
            /* keep the fallback link */
          }
        }}
        className="vr-focus text-vr-accent underline-offset-4 hover:underline"
      >
        ← Back to results
      </Link>
      <Link href="/search" className="vr-focus text-vr-muted underline-offset-4 hover:underline">
        New search
      </Link>
    </div>
  );
}
