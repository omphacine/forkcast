"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addIngredientsToShoppingList } from "../recipes/actions";
import { showToast } from "@/app/showToast";

export function AddMissingForm({
  recipeName,
  missing,
}: {
  recipeName: string;
  missing: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(() => new Set(missing));

  function toggle(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const selected = missing.filter((name) => checked.has(name));
    if (selected.length === 0) return;

    const formData = new FormData();
    for (const name of selected) formData.append("ingredient", name);

    startTransition(async () => {
      await addIngredientsToShoppingList(recipeName, formData);
      showToast(
        selected.length === 1
          ? `Added ${selected[0]} to shopping list`
          : `Added ${selected.length} items to shopping list`,
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-sm text-foreground/50">Missing:</p>
      <ul className="flex flex-col gap-1">
        {missing.map((name, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checked.has(name)}
              onChange={() => toggle(name)}
              className="h-4 w-4 shrink-0"
            />
            <span className="text-sm text-foreground/80">{name}</span>
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={isPending || checked.size === 0}
        className="self-start rounded-full border border-foreground/10 px-3 py-1 text-sm hover:bg-foreground/5 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add checked items to shopping list"}
      </button>
    </form>
  );
}
