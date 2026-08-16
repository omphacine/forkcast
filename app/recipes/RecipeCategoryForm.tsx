"use client";

import { useRef } from "react";

export function RecipeCategoryForm({
  action,
  defaultValue,
  fieldName = "category",
  placeholder = "Category",
}: {
  action: (formData: FormData) => void;
  defaultValue: string | null;
  fieldName?: string;
  placeholder?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input
        type="text"
        name={fieldName}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        onBlur={() => formRef.current?.requestSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="w-28 rounded-md border border-transparent bg-transparent text-base text-foreground/60 hover:border-foreground/10 focus:border-foreground/20 focus:outline-none"
      />
    </form>
  );
}
