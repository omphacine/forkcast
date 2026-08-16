"use client";

import { useRef } from "react";

export function InventoryExpirationForm({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-1.5">
      <span className="text-sm text-foreground/40">Expires</span>
      <input
        type="date"
        name="expirationDate"
        defaultValue={defaultValue ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Expiration date"
        className="rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-base text-foreground/60 hover:border-foreground/25 focus:border-foreground/40 focus:outline-none"
      />
    </form>
  );
}
