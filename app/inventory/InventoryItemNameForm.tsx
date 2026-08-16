"use client";

import { useRef } from "react";

export function InventoryItemNameForm({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input
        type="text"
        name="name"
        required
        defaultValue={defaultValue}
        onBlur={() => formRef.current?.requestSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-lg hover:border-foreground/10 focus:border-foreground/20 focus:outline-none"
      />
    </form>
  );
}
