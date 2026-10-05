import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { SiteHeader } from "~/components/SiteHeader";
import { themeBootScript } from "~/components/theme";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "EDCtox",
  description: "Mechanistic evidence atlas for biologically active compounds. Scores are not a toxicity rank.",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/favicon.ico", sizes: "any" },
  ],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-[var(--page)] font-sans text-stone-900 antialiased">
        <TRPCReactProvider>
          <SiteHeader />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
