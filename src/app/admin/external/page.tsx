import Link from "next/link";
import { notFound } from "next/navigation";

import { env } from "~/env";
import { prettyEnum } from "~/lib/labels";
import { externalDiagnostics } from "~/server/atlas/queries";

export const dynamic = "force-dynamic";

export default async function ExternalAdminPage() {
  if (env.NODE_ENV === "production") notFound();
  const providers = await externalDiagnostics();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm">
        <Link className="underline" href="/admin">
          Curation
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">External sources</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
        This page is development-only. It reads stored provider metadata. It does not call PubChem or CompTox, and it does not show API keys. Identity checks run from the resolve command.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-stone-500">
              <th className="py-2 pr-3 font-medium">Provider</th>
              <th className="py-2 pr-3 font-medium">Mode</th>
              <th className="py-2 pr-3 font-medium">Key</th>
              <th className="py-2 pr-3 font-medium">Links</th>
              <th className="py-2 pr-3 font-medium">Cache</th>
              <th className="py-2 font-medium">Last run</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.code} className="border-b border-stone-200">
                <td className="py-2 pr-3">
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-stone-500">{provider.code}</div>
                </td>
                <td className="py-2 pr-3">{prettyEnum(provider.accessMode)}</td>
                <td className="py-2 pr-3">
                  {provider.requiresApiKey ? (provider.apiKeyConfigured ? "Configured" : "Missing") : "Not required"}
                </td>
                <td className="py-2 pr-3">{provider.linkedCompounds}</td>
                <td className="py-2 pr-3">{provider.cachedRecords}</td>
                <td className="py-2">
                  {provider.lastRunStatus ? prettyEnum(provider.lastRunStatus) : "None"}
                  {provider.lastRunAt ? ` · ${provider.lastRunAt.slice(0, 10)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
