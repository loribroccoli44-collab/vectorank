"use client";

import { withBase } from "@/lib/base";
import { useEffect, useState, type ReactNode } from "react";
import { dataReady, setData } from "@/lib/profiles/load";
import { Shell } from "./chrome";

// Loads the two static data files once per visit (the browser then keeps them in its cache) and renders its
// children only when they are available. Pages are static shells: everything that depends on the URL (a search, a
// filter, a capsid) is computed here in the browser from the same data the site was built from.

let pending: Promise<void> | null = null;

function load(): Promise<void> {
  if (dataReady()) return Promise.resolve();
  if (!pending) {
    const get = (name: string, optional: boolean) =>
      fetch(withBase(`/data/${name}`)).then((r) => {
        if (r.ok) return r.json();
        if (optional && r.status === 404) return null;
        throw new Error(`${name}: HTTP ${r.status}`);
      });
    pending = Promise.all([get("vectorank_demo_v1.json", false), get("vectorank_llm_evidence_v1.json", true)])
      .then(([artifact, llm]) => setData(artifact, llm))
      .catch((e) => {
        pending = null;
        throw e;
      });
  }
  return pending;
}

export default function DataGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">(dataReady() ? "ready" : "loading");
  useEffect(() => {
    if (state === "ready") return;
    load().then(
      () => setState("ready"),
      () => setState("error"),
    );
  }, [state]);

  if (state === "ready") return <>{children}</>;
  return (
    <Shell>
      <div role="status" className="vr-panel mx-auto mt-10 max-w-[560px] p-8 text-center text-[14px] text-vr-muted">
        {state === "error"
          ? "The evidence data could not be loaded. Please check your connection and reload the page."
          : "Loading evidence…"}
      </div>
    </Shell>
  );
}
