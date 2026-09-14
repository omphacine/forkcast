"use client";

import { useEffect, useRef, useState } from "react";
import type { InventoryItem } from "../inventory/data";

export const NO_MATCH = "none";

const MAX_SUGGESTIONS = 8;
const NO_MATCH_LABEL = "No matching inventory item";

function displayLabel(item: InventoryItem | undefined): string {
  if (!item) return "";
  return item.quantity ? `${item.name} (${item.quantity})` : item.name;
}

// Replaces a plain <select> that listed every inventory item — with 30+
// items, scrolling that list to find a match was the exact complaint this
// was built to fix. Typing filters it instead; the hidden input keeps the
// same name/value contract the <select> had, so the surrounding form is
// unaffected.
export function InventoryItemCombobox({
  name,
  items,
  selectedId,
  onSelect,
}: {
  name: string;
  items: InventoryItem[];
  selectedId: string;
  onSelect: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItem = items.find((item) => String(item.id) === selectedId);
  const [query, setQuery] = useState(selectedId === NO_MATCH ? "" : displayLabel(selectedItem));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const filtered = query.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;
  const options = [
    { id: NO_MATCH, label: NO_MATCH_LABEL },
    ...filtered.slice(0, MAX_SUGGESTIONS).map((item) => ({ id: String(item.id), label: displayLabel(item) })),
  ];
  const activeIndex = Math.min(highlighted, options.length - 1);

  function revertQuery() {
    setQuery(selectedId === NO_MATCH ? "" : displayLabel(selectedItem));
  }

  function choose(option: { id: string; label: string }) {
    onSelect(option.id);
    setQuery(option.id === NO_MATCH ? "" : option.label);
    setOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        revertQuery();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((activeIndex + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((activeIndex - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(options[activeIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
            revertQuery();
          }
        }}
        placeholder={NO_MATCH_LABEL}
        autoComplete="off"
        className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
      />

      {open && (
        <ul className="absolute left-0 top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-foreground/10 bg-background shadow-lg">
          {options.map((option, i) => (
            <li key={option.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                className={`block w-full px-3 py-2 text-left text-base ${
                  option.id === NO_MATCH ? "text-foreground/50 italic" : ""
                } ${i === activeIndex ? "bg-foreground/10" : "hover:bg-foreground/5"}`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
