"use client";

import { useRef, useTransition, type FormEvent } from "react";
import { addSharedViewer } from "./actions";
import { showToast } from "@/app/showToast";

export function AddViewerForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addSharedViewer(formData);
      if (result.ok) {
        showToast("Invite added");
        formRef.current?.reset();
      } else {
        showToast(result.reason);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="email"
        type="email"
        placeholder="Email address"
        required
        className="min-w-0 flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
