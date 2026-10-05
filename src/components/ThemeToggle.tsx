"use client";

import { useLayoutEffect } from "react";

import { THEME_STORAGE_KEY, prefersDarkTheme } from "~/components/theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  useLayoutEffect(() => {
    applyTheme(prefersDarkTheme());
  }, []);

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      className="inline-flex size-8 items-center justify-center rounded text-stone-700 hover:bg-stone-200"
      onClick={() => {
        const dark = !document.documentElement.classList.contains("dark");
        applyTheme(dark);
        localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
      }}
    >
      <SunIcon className="theme-sun size-4" />
      <MoonIcon className="theme-moon size-4" />
    </button>
  );
}

function SunIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.25" />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
        d="M8 1.5v1.75M8 12.75V14.5M1.5 8h1.75M12.75 8H14.5M3.2 3.2l1.25 1.25M11.55 11.55l1.25 1.25M12.8 3.2l-1.25 1.25M4.45 11.55l-1.25 1.25"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.25"
        d="M10.2 2.2a5.25 5.25 0 1 0 3.6 8.9 4.4 4.4 0 0 1-3.6-8.9Z"
      />
    </svg>
  );
}
