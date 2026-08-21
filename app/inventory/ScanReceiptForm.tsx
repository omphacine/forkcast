"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import {
  addScannedInventoryItems,
  findSchnucksReceipts,
  scanCounterPhoto,
  scanReceiptEmail,
  scanReceiptManual,
  type ReceiptEmailSummary,
  type ScannedInventoryItem,
  type ScanReceiptResult,
} from "./actions";
import { LocationSelect } from "./LocationSelect";

// Grows a name textarea to fit its content so a long scanned item name is
// fully visible instead of scrolling inside a fixed-height box.
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function ScanReceiptForm({
  hasGmailImport,
  locations,
}: {
  hasGmailImport: boolean;
  locations: string[];
}) {
  const [isFinding, startFind] = useTransition();
  const [isScanning, startScan] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptEmailSummary[] | null>(null);
  const [items, setItems] = useState<ScannedInventoryItem[] | null>(null);
  const [pastedText, setPastedText] = useState("");

  function handlePhotoChange(
    e: ChangeEvent<HTMLInputElement>,
    scanFn: (formData: FormData) => Promise<ScanReceiptResult>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startScan(async () => {
      const result = await scanFn(formData);
      if (result.ok) {
        setItems(result.items);
      } else {
        setError(result.reason);
      }
      input.value = "";
    });
  }

  function handlePasteSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pastedText.trim()) return;
    setError(null);
    const formData = new FormData();
    formData.set("text", pastedText);
    startScan(async () => {
      const result = await scanReceiptManual(formData);
      if (result.ok) {
        setItems(result.items);
        setPastedText("");
      } else {
        setError(result.reason);
      }
    });
  }

  function handleFind() {
    setError(null);
    startFind(async () => {
      const result = await findSchnucksReceipts();
      if (result.ok) {
        setReceipts(result.receipts);
      } else {
        setError(result.reason);
      }
    });
  }

  function handleScanEmail(messageId: string) {
    setError(null);
    startScan(async () => {
      const result = await scanReceiptEmail(messageId);
      if (result.ok) {
        setItems(result.items);
        setReceipts(null);
      } else {
        setError(result.reason);
      }
    });
  }

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(async () => {
      await addScannedInventoryItems(formData);
      setItems(null);
    });
  }

  if (items) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
        <p className="text-base text-foreground/60">
          Uncheck anything you don&apos;t want tracked, fix names or quantities, and add a
          location where it&apos;s going.
        </p>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <input type="hidden" name="count" value={items.length} />
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 rounded-md border border-foreground/10 p-2"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name={`include-${i}`}
                    defaultChecked
                    className="mt-1.5 h-5 w-5 shrink-0"
                  />
                  <textarea
                    name={`name-${i}`}
                    defaultValue={item.name}
                    ref={(el) => {
                      if (el) autoGrow(el);
                    }}
                    onInput={(e) => autoGrow(e.currentTarget)}
                    rows={1}
                    className="min-w-0 flex-1 resize-none overflow-hidden rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-7">
                  <input
                    name={`quantity-${i}`}
                    defaultValue={item.quantity ?? ""}
                    placeholder="Quantity"
                    className="w-24 rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
                  />
                  <input
                    name={`category-${i}`}
                    defaultValue={item.category ?? ""}
                    placeholder="Category"
                    className="w-28 rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
                  />
                  <LocationSelect
                    name={`location-${i}`}
                    locations={locations}
                    defaultValue={null}
                    className="w-32 rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? "Adding…" : "Add checked items"}
            </button>
            <button
              type="button"
              onClick={() => setItems(null)}
              disabled={isSaving}
              className="rounded-full border border-foreground/10 px-5 py-2 text-base font-medium hover:bg-foreground/5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (receipts) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
        <p className="text-base text-foreground/60">Pick a receipt to scan:</p>
        <ul className="flex flex-col gap-2">
          {receipts.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => handleScanEmail(r.id)}
                disabled={isScanning}
                className="w-full rounded-md border border-foreground/10 px-3 py-2 text-left hover:border-primary disabled:opacity-50"
              >
                <span className="block text-base font-medium">{r.subject}</span>
                <span className="block text-sm text-foreground/50">{r.date}</span>
              </button>
            </li>
          ))}
        </ul>
        {isScanning && <p className="text-base text-foreground/60">Reading receipt…</p>}
        <button
          type="button"
          onClick={() => setReceipts(null)}
          disabled={isScanning}
          className="self-start text-base text-foreground/60 underline"
        >
          Cancel
        </button>
        {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 aria-disabled:opacity-50">
            {isScanning ? "Reading…" : "Scan a receipt photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(e, scanReceiptManual)}
              disabled={isScanning}
              className="hidden"
            />
          </label>
          <label className="cursor-pointer rounded-full border border-foreground/10 px-5 py-2 text-base font-medium hover:bg-foreground/5 aria-disabled:opacity-50">
            {isScanning ? "Reading…" : "Scan items on your counter"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(e, scanCounterPhoto)}
              disabled={isScanning}
              className="hidden"
            />
          </label>
          {hasGmailImport && (
            <button
              type="button"
              onClick={handleFind}
              disabled={isFinding}
              className="rounded-full border border-foreground/10 px-5 py-2 text-base font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              {isFinding ? "Looking…" : "Import from Schnucks email"}
            </button>
          )}
        </div>
        <p className="text-sm text-foreground/50">
          Reads a photo of a paper receipt, or a photo of items sitting out (like groceries on
          the counter), and lists what it finds for you to review before anything is added to
          inventory.
        </p>
      </div>

      <form onSubmit={handlePasteSubmit} className="flex flex-col gap-2">
        <label className="text-base text-foreground/60">
          Or paste the text of an e-receipt
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={4}
            placeholder="Paste receipt text here..."
            disabled={isScanning}
            className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={isScanning || !pastedText.trim()}
          className="self-start rounded-full border border-foreground/10 px-5 py-2 text-base font-medium hover:bg-foreground/5 disabled:opacity-50"
        >
          {isScanning ? "Reading…" : "Read pasted receipt"}
        </button>
      </form>

      {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
