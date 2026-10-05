"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { setCuratorDecision } from "~/app/admin/literature/actions";
import { prettyEnum } from "~/lib/labels";
import type { ScreeningCard } from "~/server/screening/queue";
import {
  reasonsForDecision,
  type ScreeningDecisionName,
  type ScreeningReasonName,
} from "~/server/screening/reasons";

function linksFor(card: ScreeningCard): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];
  if (card.pmid && /^\d+$/.test(card.pmid)) {
    links.push({ href: `https://pubmed.ncbi.nlm.nih.gov/${card.pmid}/`, label: "PubMed" });
    links.push({ href: `https://europepmc.org/article/MED/${card.pmid}`, label: "Europe PMC" });
  }
  if (card.pmcid && /^PMC\d+$/i.test(card.pmcid)) {
    links.push({ href: `https://europepmc.org/article/${card.pmcid}`, label: "PMC" });
  }
  if (card.doi?.startsWith("10.")) links.push({ href: `https://doi.org/${card.doi}`, label: "DOI" });
  return links;
}

function CardForm({
  card,
  onError,
}: {
  card: ScreeningCard;
  onError: (message: string | null) => void;
}) {
  const initial = card.curatorDecision === "INCLUDE" || card.curatorDecision === "EXCLUDE" || card.curatorDecision === "UNCERTAIN"
    ? card.curatorDecision
    : "INCLUDE";
  const [mode, setMode] = useState<ScreeningDecisionName>(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const decisionRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLSelectElement>(null);
  const reasons = reasonsForDecision(mode, card.governingPurpose);

  function submit(next: ScreeningDecisionName) {
    const reason = reasonRef.current?.value ?? "";
    const allowed = reasonsForDecision(next, card.governingPurpose);
    if (next === "EXCLUDE" && !allowed.includes(reason as ScreeningReasonName)) {
      setMode("EXCLUDE");
      onError("Exclude requires a reason code.");
      reasonRef.current?.focus();
      return;
    }
    if (decisionRef.current) decisionRef.current.value = next;
    if (reasonRef.current && !allowed.includes(reason as ScreeningReasonName)) reasonRef.current.value = "";
    setMode(next);
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      className="mt-3 flex flex-wrap items-end gap-2"
      action={async (formData) => {
        const result = await setCuratorDecision(formData);
        onError(result.error ?? null);
      }}
    >
      <input type="hidden" name="evidenceSourceId" value={card.sourceId} />
      <input ref={decisionRef} type="hidden" name="decision" value={mode} />
      <label className="text-xs text-stone-600">
        {prettyEnum(mode)} reason
        <select ref={reasonRef} name="reasonCode" defaultValue={card.curatorReasonCode ?? ""} className="mt-1 block border border-stone-300 bg-white px-2 py-1 text-sm">
          {mode === "EXCLUDE" ? null : <option value="">None</option>}
          {reasons.map((reason) => (
            <option key={reason} value={reason}>
              {prettyEnum(reason)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-stone-600">
        Note
        <input name="notes" defaultValue={card.curatorNotes ?? ""} className="mt-1 block w-56 border border-stone-300 px-2 py-1 text-sm" />
      </label>
      {(["INCLUDE", "EXCLUDE", "UNCERTAIN"] as ScreeningDecisionName[]).map((decision) => (
        <button
          key={decision}
          type="button"
          className="border border-stone-400 px-2 py-1 text-sm"
          disabled={decision === "INCLUDE" && card.retracted}
          onClick={() => submit(decision)}
        >
          {prettyEnum(decision)}
        </button>
      ))}
      <button
        type="button"
        className="border border-stone-400 px-2 py-1 text-sm"
        onClick={() => {
          if (decisionRef.current) decisionRef.current.value = "RESET";
          formRef.current?.requestSubmit();
        }}
      >
        Reset
      </button>
    </form>
  );
}

export function ScreeningDesk({ cards }: { cards: ScreeningCard[] }) {
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const current = Math.min(selected, Math.max(cards.length - 1, 0));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const card = cards[current];
    if (!card) return;
    const article = document.getElementById(`screen-${card.sourceId}`);
    if (event.key === "j" || event.key === "k") {
      event.preventDefault();
      const next = event.key === "j" ? Math.min(current + 1, cards.length - 1) : Math.max(current - 1, 0);
      setSelected(next);
      document.getElementById(`screen-${cards[next]?.sourceId ?? ""}`)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "a" || event.key === "A") {
      const details = article?.querySelector("details");
      if (details) details.open = !details.open;
    }
    if (event.key === "o" || event.key === "O") {
      const href = linksFor(card)[0]?.href;
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    }
    const decision = event.key === "i" ? "INCLUDE" : event.key === "e" ? "EXCLUDE" : event.key === "u" ? "UNCERTAIN" : null;
    if (!decision || (decision === "INCLUDE" && card.retracted)) return;
    article?.querySelectorAll("button")[decision === "INCLUDE" ? 0 : decision === "EXCLUDE" ? 1 : 2]?.click();
  }

  if (cards.length === 0) return <p className="mt-4 text-sm text-stone-600">No publications match these filters.</p>;

  return (
    <div className="mt-4 space-y-3 outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <p className="text-xs text-stone-500">Keys: j/k move, i include, e exclude, u uncertain, a abstract, o open link. Typing in a field ignores those keys.</p>
      {error ? <p className="text-sm text-stone-800">{error}</p> : null}
      {cards.map((card, index) => (
        <article
          key={card.sourceId}
          id={`screen-${card.sourceId}`}
          className={`rounded border bg-white p-3 ${index === current ? "border-stone-900" : "border-stone-300"}`}
          onClick={() => setSelected(index)}
        >
          <h2 className="text-base font-medium leading-6">{card.title}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {card.year ?? "Year not supplied"} · {card.journal}
            {card.studySignal ? ` · ${card.studySignal}` : ""}
            {card.openAccess === true ? " · open access" : ""}
            {card.retracted ? " · retracted" : ""}
            {card.abstractText ? " · abstract stored" : " · no abstract"}
          </p>
          <p className="mt-1 flex flex-wrap gap-3 text-sm">
            {linksFor(card).map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="underline">
                {link.label}
              </a>
            ))}
            {card.pmid ? <span>PMID {card.pmid}</span> : null}
            {card.doi ? <span>DOI {card.doi}</span> : null}
          </p>
          <ul className="mt-2 text-sm text-stone-700">
            {[...new Set(card.provenance)].map((line) => (
              <li key={line}>Found by {line}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            Machine:{" "}
            {card.machineDecision
              ? `${prettyEnum(card.machineDecision)}${card.machineReason ? `, ${prettyEnum(card.machineReason)}` : ""}${card.machineConfidence ? `, ${prettyEnum(card.machineConfidence)}` : ""}`
              : "no suggestion"}
            {card.machineRationale ? `. ${card.machineRationale}` : ""}
          </p>
          <p className="text-sm">
            Curator: {card.curatorDecision ? prettyEnum(card.curatorDecision) : "unscreened"}
            {card.curatorReasonCode ? `, ${prettyEnum(card.curatorReasonCode)}` : ""}
          </p>
          {card.abstractText ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer">{card.abstractLabel ?? "Abstract"}</summary>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-stone-800">{card.abstractText}</p>
            </details>
          ) : null}
          <CardForm card={card} onError={setError} />
        </article>
      ))}
    </div>
  );
}
