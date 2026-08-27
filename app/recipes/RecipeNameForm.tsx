"use client";

import { useRef } from "react";

// A single-line <input> can never wrap long text — it just clips at the box
// edge, which is exactly what a long recipe title did on a phone screen.
// A textarea wraps naturally; autoGrow keeps its height matched to content
// so it still reads as a plain (if multi-line) title, not a text box. Same
// technique already used for scanned item names in inventory/ScanReceiptForm.
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

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
        ref={(el) => {
          if (el) autoGrow(el);
        }}
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
