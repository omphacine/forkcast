"use client";

import { useState } from "react";

const ADD_NEW = "__add_new__";

export function LocationSelect({
  locations,
  defaultValue,
  name = "location",
  onCommit,
  className = "rounded-md border border-transparent bg-transparent text-base text-foreground/60 hover:border-foreground/10 focus:border-foreground/20 focus:outline-none",
}: {
  locations: string[];
  defaultValue: string | null;
  name?: string;
  onCommit?: () => void;
  className?: string;
}) {
  const isKnown = defaultValue !== null && locations.includes(defaultValue);
  const [adding, setAdding] = useState(defaultValue !== null && !isKnown);

  if (adding) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="text"
          name={name}
          placeholder="New location"
          defaultValue={defaultValue ?? ""}
          autoFocus
          onBlur={() => onCommit?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit?.();
            }
          }}
          className={className}
        />
        <button
          type="button"
          onClick={() => setAdding(false)}
          aria-label="Cancel adding new location"
          className="text-sm text-foreground/40 hover:text-foreground/60"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
        } else {
          onCommit?.();
        }
      }}
      className={className}
    >
      <option value="">No location</option>
      {locations.map((location) => (
        <option key={location} value={location}>
          {location}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new location…</option>
    </select>
  );
}
