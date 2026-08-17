"use client";

import { useTransition, type FormEvent } from "react";
import { createRecipe, type ScanRecipeResult } from "../actions";

type Scanned = Extract<ScanRecipeResult, { ok: true }>;

export function ScannedRecipeReview({
  scanned,
  defaultSourceName,
  onDiscard,
}: {
  scanned: Scanned;
  defaultSourceName?: string;
  onDiscard: () => void;
}) {
  const [isSaving, startSave] = useTransition();

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(() => createRecipe(formData));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
      <p className="text-base text-foreground/60">
        Review what was scanned, then save. Fix anything that looks off.
      </p>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <input
          name="name"
          defaultValue={scanned.name}
          required
          className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
        <div className="flex flex-wrap gap-3">
          <input
            name="sourceName"
            defaultValue={defaultSourceName ?? ""}
            placeholder="Source: cookbook, website, etc. (optional)"
            className="min-w-[220px] flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="sourcePage"
            placeholder="Page (optional)"
            className="w-28 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
        </div>
        <label className="text-base text-foreground/60">
          Ingredients (one per line)
          <textarea
            name="ingredients"
            rows={Math.max(5, scanned.ingredients.length)}
            defaultValue={scanned.ingredients.join("\n")}
            className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
        </label>
        <label className="text-base text-foreground/60">
          Instructions (optional)
          <textarea
            name="instructions"
            rows={4}
            defaultValue={scanned.instructions ?? ""}
            className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save recipe"}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded-full border border-foreground/10 px-5 py-2 text-base font-medium hover:bg-foreground/5"
          >
            Start over
          </button>
        </div>
      </form>
    </div>
  );
}
