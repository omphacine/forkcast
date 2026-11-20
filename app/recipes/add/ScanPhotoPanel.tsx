"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { scanRecipeImage, type ScanRecipeResult } from "../actions";
import { ScannedRecipeReview } from "./ScannedRecipeReview";
import { resizePhoto } from "./resizePhoto";
import { MAX_SCAN_PHOTOS } from "./scanLimits";

type Scanned = Extract<ScanRecipeResult, { ok: true }>;
type StagedPhoto = { id: number; blob: Blob; previewUrl: string };

export function ScanPhotoPanel() {
  const [isScanning, startScan] = useTransition();
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const nextId = useRef(0);
  const busy = isScanning || isPreparing;

  async function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Cleared so picking the same photo again still fires a change.
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    const room = MAX_SCAN_PHOTOS - photos.length;
    const accepted = files.slice(0, room);

    setIsPreparing(true);
    const added: StagedPhoto[] = [];
    let failed = 0;
    for (const file of accepted) {
      try {
        const blob = await resizePhoto(file);
        added.push({ id: nextId.current++, blob, previewUrl: URL.createObjectURL(blob) });
      } catch {
        failed++;
      }
    }
    setPhotos((prev) => [...prev, ...added]);
    setIsPreparing(false);

    const problems: string[] = [];
    if (failed > 0) {
      problems.push(
        `Couldn't read ${failed === 1 ? "one photo" : `${failed} photos`} — try a JPEG or PNG.`,
      );
    }
    if (files.length > room) problems.push(`Up to ${MAX_SCAN_PHOTOS} photos per recipe.`);
    if (problems.length > 0) setError(problems.join(" "));
  }

  function removePhoto(id: number) {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setError(null);
  }

  function clearPhotos() {
    for (const photo of photos) URL.revokeObjectURL(photo.previewUrl);
    setPhotos([]);
  }

  function handleScan() {
    if (photos.length === 0) return;
    setError(null);
    const formData = new FormData();
    photos.forEach((photo, i) => {
      formData.append("photo", new File([photo.blob], `photo-${i + 1}.jpg`, { type: "image/jpeg" }));
    });
    startScan(async () => {
      try {
        const result = await scanRecipeImage(formData);
        if (result.ok) {
          setScanned(result);
        } else {
          setError(result.reason);
        }
      } catch {
        setError("Couldn't scan those photos. Please try again.");
      }
    });
  }

  if (scanned) {
    return (
      <ScannedRecipeReview
        scanned={scanned}
        onDiscard={() => {
          clearPhotos();
          setScanned(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {photos.map((photo, i) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={`Photo ${i + 1}`}
                className="h-24 w-24 rounded-md border border-foreground/10 object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded-full bg-background/85 px-1.5 text-xs font-medium">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                disabled={busy}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-base leading-none hover:bg-background disabled:opacity-50"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {photos.length > 0 && (
          <button
            type="button"
            onClick={handleScan}
            disabled={busy}
            className="rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isScanning
              ? "Reading…"
              : photos.length === 1
                ? "Scan this photo"
                : `Scan these ${photos.length} photos`}
          </button>
        )}
        {photos.length < MAX_SCAN_PHOTOS && (
          <label
            aria-disabled={busy}
            className={`cursor-pointer rounded-full px-5 py-2 text-base font-medium aria-disabled:opacity-50 ${
              photos.length === 0
                ? "bg-primary text-white hover:opacity-90"
                : "border border-foreground/10 hover:bg-foreground/5"
            }`}
          >
            {isPreparing
              ? "Preparing…"
              : photos.length === 0
                ? "Scan a recipe photo"
                : "Add another photo"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
              disabled={busy}
              className="hidden"
            />
          </label>
        )}
      </div>

      <p className="text-sm text-foreground/50">
        Take or choose photos of a recipe card, cookbook page, or handwritten note &mdash; add
        more than one if it runs across several pages (up to {MAX_SCAN_PHOTOS}, read in order
        as one recipe) &mdash; and ForkCast fills in the fields below for you to check.
      </p>
      {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
