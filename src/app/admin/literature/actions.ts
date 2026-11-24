"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { NotCuratorError, requireCurator } from "~/server/curator";
import { db } from "~/server/db";
import { ScreeningError, applyCuratorDecision } from "~/server/screening/curate";
import { SCREENING_DECISIONS } from "~/server/screening/reasons";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function setCuratorDecision(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireCurator();
  } catch (error) {
    if (error instanceof NotCuratorError) notFound();
    throw error;
  }
  const evidenceSourceId = field(formData, "evidenceSourceId");
  const decision = field(formData, "decision");
  const reasonCode = field(formData, "reasonCode");
  const notes = field(formData, "notes");
  if (decision !== "RESET" && !(SCREENING_DECISIONS as readonly string[]).includes(decision)) {
    return { error: "Unknown screening decision." };
  }
  try {
    await applyCuratorDecision(db, {
      evidenceSourceId,
      decision: decision as "INCLUDE" | "EXCLUDE" | "UNCERTAIN" | "RESET",
      reasonCode: reasonCode.length > 0 ? reasonCode : null,
      notes: notes.length > 0 ? notes : null,
    });
  } catch (error) {
    if (error instanceof ScreeningError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/literature");
  return {};
}
