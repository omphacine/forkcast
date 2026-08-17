"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { createRecipe, scanRecipeImage, scanRecipeUrl, type ScanRecipeResult } from "./actions";

type Scanned = Extract<ScanRecipeResult, { ok: true }>;

export function ScanRecipeForm() {
  const [isScanning, startScan] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [scannedFromUrl, setScannedFromUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startScan(async () => {
      const result = await scanRecipeImage(formData);
      if (result.ok) {
        setScanned(result);
        setScannedFromUrl(null);
      } else {
        setError(result.reason);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleUrlSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setError(null);
    startScan(async () => {
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

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(async () => {
      await createRecipe(formData);
      setScanned(null);
    });
  }

  if (scanned) {
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
              defaultValue={scannedFromUrl ?? ""}
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
              onClick={() => setScanned(null)}
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

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <div className="flex flex-col gap-2">
        <label className="self-start cursor-pointer rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 aria-disabled:opacity-50">
          {isScanning ? "Reading photo…" : "Scan a recipe photo"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={isScanning}
            className="hidden"
          />
        </label>
        <p className="text-sm text-foreground/50">
          Takes a photo of a recipe card, cookbook page, or handwritten note and fills in the
          fields below for you to check.
        </p>
      </div>

      <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2">
        <label className="text-base text-foreground/60">
          Or import from a recipe URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/some-recipe"
            disabled={isScanning}
            className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
        </label>
        <button
          type="submit"
          disabled={isScanning || !url.trim()}
          className="self-start rounded-full border border-foreground/10 px-5 py-2 text-base font-medium hover:bg-foreground/5 disabled:opacity-50"
        >
          {isScanning ? "Reading…" : "Import from URL"}
        </button>
      </form>

      {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
