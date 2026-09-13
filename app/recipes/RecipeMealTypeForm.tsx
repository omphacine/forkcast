"use client";

import { useRef } from "react";
import { MEAL_TYPES } from "./mealTypes";

export function RecipeMealTypeForm({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <select
        name="mealType"
        defaultValue={defaultValue ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-transparent bg-transparent text-base text-foreground/60 hover:border-foreground/10 focus:border-foreground/20 focus:outline-none"
      >
        <option value="">Meal type</option>
        {MEAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </form>
  );
}
