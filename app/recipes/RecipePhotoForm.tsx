"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";

// Resizes/compresses in the browser before upload so a phone photo (often
// several MB) doesn't get stored as-is in a Postgres text column.
async function resizeImage(file: File, maxDim = 1000, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function RecipePhotoForm({
  photoDataUrl,
  onUpload,
  onRemove,
}: {
  photoDataUrl: string | null;
  onUpload: (dataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const dataUrl = await resizeImage(file);
        await onUpload(dataUrl);
      } catch {
        setError("Couldn't read that photo.");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex items-center gap-3">
      {photoDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoDataUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="flex flex-col items-start gap-1">
        <label className="cursor-pointer text-base text-secondary underline aria-disabled:opacity-50">
          {isPending ? "Uploading…" : photoDataUrl ? "Replace photo" : "Add a photo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleChange}
            disabled={isPending}
            className="hidden"
          />
        </label>
        {photoDataUrl && (
          <button
            type="button"
            onClick={() => startTransition(onRemove)}
            disabled={isPending}
            className="text-sm text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            Remove
          </button>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
