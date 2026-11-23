import { Suspense } from "react";
import type { Metadata } from "next";
import { getProfile, loadProfiles } from "@/lib/profiles/load";
import { primeServerData } from "@/lib/profiles/server-data";
import DataGate from "../../_ui/DataGate";
import CandidateView from "./CandidateView";

// One static page per capsid profile, generated at build time from the committed data. Anything that depends on the
// URL query (evidence filters, page size) is applied in the browser by CandidateView.
export const dynamicParams = false;

export function generateStaticParams() {
  primeServerData();
  return loadProfiles().profiles.map((p) => ({ id: p.candidate_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  primeServerData();
  const { id } = await params;
  const profile = getProfile(decodeURIComponent(id));
  return { title: profile ? `${profile.canonical_name} · VectoRank` : "VectoRank" };
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <DataGate>
        <CandidateView id={id} />
      </DataGate>
    </Suspense>
  );
}
