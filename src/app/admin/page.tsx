import { notFound } from "next/navigation";

import { env } from "~/env";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (env.NODE_ENV === "production") notFound();
  const counts = await api.atlas.counts();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Curation</h1>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        This page is development-only. It does not edit scores. Later curation should create compounds, sources, and findings in Postgres, link findings to mechanism and outcome assessments, and write an assessment revision with a reason whenever a score changes. Service keys stay on the server.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {Object.entries(counts).map(([key, value]) => (
          <div key={key} className="rounded border border-stone-300 bg-white p-3">
            <dt className="text-stone-500">{key}</dt>
            <dd className="text-xl font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
