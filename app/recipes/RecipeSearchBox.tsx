"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RecipeName } from "./data";

const MAX_SUGGESTIONS = 8;

export function RecipeSearchBox({
  recipes,
  defaultValue,
}: {
  recipes: RecipeName[];
  defaultValue: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = query.trim()
    ? recipes
        .filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  // Clamp rather than reset via effect — the list this indexes shrinks as
  // the query narrows it, so derive a safe index at render time instead of
  // syncing state to state in an effect.
  const activeIndex = Math.min(highlighted, suggestions.length - 1);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <form method="GET" className="flex w-full gap-2">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((activeIndex + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((activeIndex - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              router.push(`/recipes/${suggestions[activeIndex].id}`);
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search recipes by name"
          autoComplete="off"
          className="w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-base focus:border-foreground/30 focus:outline-none"
        />
        {defaultValue && (
          <Link
            href="/recipes"
            className="shrink-0 rounded-md border border-foreground/10 px-3 py-2 text-base text-foreground/60 hover:bg-foreground/5"
          >
            Clear
          </Link>
        )}
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-md border border-foreground/10 bg-background shadow-lg">
          {suggestions.map((recipe, i) => (
            <li key={recipe.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  router.push(`/recipes/${recipe.id}`);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-base ${
                  i === activeIndex ? "bg-foreground/10" : "hover:bg-foreground/5"
                }`}
              >
                {recipe.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
