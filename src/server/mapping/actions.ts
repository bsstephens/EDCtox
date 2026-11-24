"use server";

import { revalidateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { ATLAS_CACHE_TAG } from "~/server/cache";
import { curatorWritesAllowed } from "~/server/curator";
import { db } from "~/server/db";

import { applyClaimMapping } from "./apply";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function publicMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "The mapping could not be saved.";
  if (message.includes("://") || message.toLowerCase().includes("postgres")) return "The mapping could not be saved.";
  return message;
}

async function run(command: Parameters<typeof applyClaimMapping>[1]) {
  // Checked here rather than in each action, so a new mapping action cannot be added without it,
  // and checked in the action rather than only in a route guard, because a server action is its
  // own POST endpoint and a route matcher stops covering it the moment it is used from elsewhere.
  if (!curatorWritesAllowed()) notFound();
  let message: string | null = null;
  try {
    await applyClaimMapping(db, command);
    // Public mechanism and compound pages read claim mappings from the cache.
    revalidateTag(ATLAS_CACHE_TAG);
  } catch (error) {
    message = publicMessage(error);
  }
  const suffix = message ? `?error=${encodeURIComponent(message)}` : "";
  redirect(`/admin/mechanisms/mapping${suffix}`);
}

function noteOrNull(formData: FormData): string | null {
  const note = text(formData, "note");
  return note ? note : null;
}

export async function verifyMapping(formData: FormData) {
  await run({ action: "VERIFY", claimId: text(formData, "claimId"), note: noteOrNull(formData) });
}

export async function remapMapping(formData: FormData) {
  await run({
    action: "REMAP",
    claimId: text(formData, "claimId"),
    mechanismCode: text(formData, "mechanismCode"),
    note: noteOrNull(formData),
  });
}

export async function unmapMapping(formData: FormData) {
  await run({ action: "UNMAP", claimId: text(formData, "claimId"), note: noteOrNull(formData) });
}
