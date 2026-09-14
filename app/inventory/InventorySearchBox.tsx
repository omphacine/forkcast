"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { InventoryItemName } from "./data";

const MAX_SUGGESTIONS = 8;

export function InventorySearchBox({
  items,
  defaultValue,
  tz,
}: {
  items: InventoryItemName[];
  defaultValue: string;
  tz: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = query.trim()
    ? items
        .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, MAX_SUGGESTIONS)
    : [];
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

  function choose(name: string) {
    setQuery(name);
    setOpen(false);
    // Submit on the next tick so the input's value has updated first.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <form ref={formRef} method="GET" action="/inventory" className="flex w-full gap-2">
        <input type="hidden" name="tz" value={tz} />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
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
              choose(suggestions[activeIndex].name);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search inventory by name"
          autoComplete="off"
          className="w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-base focus:border-foreground/30 focus:outline-none"
        />
        {defaultValue && (
          <Link
            href={`/inventory?tz=${encodeURIComponent(tz)}`}
            className="shrink-0 rounded-md border border-foreground/10 px-3 py-2 text-base text-foreground/60 hover:bg-foreground/5"
          >
            Clear
          </Link>
        )}
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-md border border-foreground/10 bg-background shadow-lg">
          {suggestions.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item.name)}
                className={`block w-full px-3 py-2 text-left text-base ${
                  i === activeIndex ? "bg-foreground/10" : "hover:bg-foreground/5"
                }`}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
