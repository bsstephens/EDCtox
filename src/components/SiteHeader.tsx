import Link from "next/link";

const links = [
  ["/", "Compounds"],
  ["/compare", "Compare"],
  ["/evidence", "Evidence"],
  ["/methodology", "Methodology"],
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-stone-300 bg-[#f7f4ee]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 py-4">
        <div>
          <Link href="/" className="text-lg font-semibold tracking-tight text-stone-900">
            EDCtox
          </Link>
          <p className="max-w-xl text-sm text-stone-600">
            Mechanistic evidence atlas. Scores summarise biological direction and magnitude. They are not a toxicity rank or a human-risk number.
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="text-stone-800 underline-offset-4 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
