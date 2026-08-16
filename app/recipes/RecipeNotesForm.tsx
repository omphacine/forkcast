"use client";

import { useRef } from "react";

export function RecipeNotesForm({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <textarea
        name="notes"
        rows={4}
        defaultValue={defaultValue ?? ""}
        onBlur={() => formRef.current?.requestSubmit()}
        placeholder="Modifications you made, what worked, what to change next time..."
        className="mt-2 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
      />
    </form>
  );
}
