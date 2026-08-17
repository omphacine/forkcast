"use client";

import { useState, useTransition, type FormEvent } from "react";
import { scanRecipeUrl, type ScanRecipeResult } from "../actions";
import { ScannedRecipeReview } from "./ScannedRecipeReview";

type Scanned = Extract<ScanRecipeResult, { ok: true }>;

export function ImportUrlPanel() {
  const [isImporting, startImport] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [scannedFromUrl, setScannedFromUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setError(null);
    startImport(async () => {
      const result = await scanRecipeUrl(trimmedUrl);
      if (result.ok) {
        setScanned(result);
        setScannedFromUrl(trimmedUrl);
        setUrl("");
      } else {
        setError(result.reason);
      }
    });
  }

  if (scanned) {
    return (
      <ScannedRecipeReview
        scanned={scanned}
        defaultSourceName={scannedFromUrl ?? ""}
        onDiscard={() => setScanned(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="text-base text-foreground/60">
          Recipe URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/some-recipe"
            disabled={isImporting}
            className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
        </label>
        <button
          type="submit"
          disabled={isImporting || !url.trim()}
          className="self-start rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isImporting ? "Reading…" : "Import from URL"}
        </button>
      </form>
      <p className="text-sm text-foreground/50">
        Reads the recipe straight off the page — works best with a link directly to the recipe,
        not a roundup or landing page.
      </p>
      {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
