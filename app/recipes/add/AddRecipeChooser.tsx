"use client";

import { useState } from "react";
import { ScanPhotoPanel } from "./ScanPhotoPanel";
import { ImportUrlPanel } from "./ImportUrlPanel";
import { ManualRecipeForm } from "./ManualRecipeForm";

type Mode = "scan" | "url" | "manual";

const OPTIONS: { mode: Mode; label: string; description: string }[] = [
  { mode: "scan", label: "Scan a recipe", description: "Photo of a card, cookbook, or note" },
  { mode: "url", label: "Import from a website", description: "Paste a link to a recipe" },
  { mode: "manual", label: "Add manually", description: "Type it in yourself" },
];

export function AddRecipeChooser() {
  const [mode, setMode] = useState<Mode>("scan");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => setMode(option.mode)}
            className={`rounded-lg border p-4 text-left ${
              mode === option.mode
                ? "border-secondary bg-secondary/10"
                : "border-foreground/10 hover:border-primary"
            }`}
          >
            <p
              className={`font-heading text-lg font-medium ${
                mode === option.mode ? "text-secondary" : ""
              }`}
            >
              {option.label}
            </p>
            <p className="mt-1 text-base text-foreground/60">{option.description}</p>
          </button>
        ))}
      </div>

      {mode === "scan" && <ScanPhotoPanel />}
      {mode === "url" && <ImportUrlPanel />}
      {mode === "manual" && <ManualRecipeForm />}
    </div>
  );
}
