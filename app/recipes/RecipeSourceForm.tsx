"use client";

import { useRef } from "react";

export function RecipeSourceForm({
  action,
  defaultName,
  defaultPage,
}: {
  action: (formData: FormData) => void;
  defaultName: string | null;
  defaultPage: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    formRef.current?.requestSubmit();
  }

  function submitOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="sourceName"
        placeholder="Cookbook, website, etc."
        defaultValue={defaultName ?? ""}
        onBlur={submit}
        onKeyDown={submitOnEnter}
        className="min-w-[180px] flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
      <input
        type="text"
        name="sourcePage"
        placeholder="Page"
        defaultValue={defaultPage ?? ""}
        onBlur={submit}
        onKeyDown={submitOnEnter}
        className="w-24 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
    </form>
  );
}
