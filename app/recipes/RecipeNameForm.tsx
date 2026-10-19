"use client";

import { useRef } from "react";
import { autoGrow, autoGrowRef } from "../autoGrow";

export function RecipeNameForm({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <textarea
        name="name"
        required
        rows={1}
        defaultValue={defaultValue}
        ref={autoGrowRef}
        onInput={(e) => autoGrow(e.currentTarget)}
        onBlur={() => formRef.current?.requestSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="block w-full min-w-0 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1 font-heading text-4xl font-semibold hover:border-foreground/10 focus:border-foreground/20 focus:outline-none"
      />
    </form>
  );
}
