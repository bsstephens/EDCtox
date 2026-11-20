import Link from "next/link";

/**
 * Table and Map are peers, not a view and its fallback. Both are real routes, so the back
 * button works and robots.txt, which blocks every query-string URL, still indexes them.
 *
 * It is also the accessibility answer: the table is the text equivalent of the map and it is
 * one labelled click away, rather than being offered as a lesser alternative.
 */
const VIEWS = [
  { href: "/", label: "Table" },
  { href: "/coverage", label: "Map" },
] as const;

export function ViewSwitch({ current }: { current: "/" | "/coverage" }) {
  return (
    <nav
      aria-label="Compound views"
      className="inline-flex rounded border border-stone-300 bg-white p-0.5 text-sm"
    >
      {VIEWS.map((view) => {
        const active = view.href === current;
        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-1 ${active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"}`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
