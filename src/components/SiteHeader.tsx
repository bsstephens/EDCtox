import Link from "next/link";

import { ThemeToggle } from "~/components/ThemeToggle";

const links = [
  ["/", "Compounds"],
  ["/compare", "Compare"],
  ["/evidence", "Evidence"],
  ["/methodology", "Methodology"],
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-stone-300 bg-[var(--header)]">
      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl pr-10 sm:pr-0">
          <Link href="/" className="text-lg font-semibold tracking-tight text-stone-900">
            EDCtox
          </Link>
          <p className="text-sm text-stone-600">
            Mechanistic evidence atlas. Scores summarise biological direction and magnitude. They are not a toxicity rank or a human-risk number.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="absolute top-4 right-4 sm:static">
            <ThemeToggle />
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="text-stone-800 underline-offset-4 hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
