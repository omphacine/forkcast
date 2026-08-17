"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { scanRecipeImage, type ScanRecipeResult } from "../actions";
import { ScannedRecipeReview } from "./ScannedRecipeReview";

type Scanned = Extract<ScanRecipeResult, { ok: true }>;

export function ScanPhotoPanel() {
  const [isScanning, startScan] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
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
      } else {
        setError(result.reason);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  if (scanned) {
    return <ScannedRecipeReview scanned={scanned} onDiscard={() => setScanned(null)} />;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4">
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
      {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
