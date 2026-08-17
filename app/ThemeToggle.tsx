"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Server render has no localStorage/matchMedia — useSyncExternalStore uses
// this for the initial hydration pass, then immediately re-renders with the
// real client value from readTheme(), with no mismatch warning.
function getServerSnapshot(): Theme | null {
  return null;
}

function setTheme(next: Theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(next);
  localStorage.setItem("theme", next);
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-background text-lg text-foreground/70 shadow-sm hover:text-foreground"
    >
      {theme === "dark" ? "☀" : theme === "light" ? "☾" : ""}
    </button>
  );
}
