"use client";

import { useRef, useState, useTransition } from "react";
import {
  addRecipeIngredient,
  deleteRecipeIngredient,
  moveRecipeIngredient,
  updateRecipeIngredient,
} from "./actions";
import type { Ingredient } from "./data";

// Lives inside the "Add checked items to shopping list" <form> in the parent
// page (the checkboxes need to belong to that form to submit together), so
// every control in here must avoid its own <form> — forms can't nest. Edits
// and adds instead call the server actions directly.
export function RecipeIngredientsList({
  recipeId,
  ingredients,
}: {
  recipeId: number;
  ingredients: Ingredient[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const formData = new FormData();
    formData.set("name", name);
    startTransition(async () => {
      await addRecipeIngredient(recipeId, formData);
      setNewName("");
      newInputRef.current?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {ingredients.map((ingredient, index) => (
        <div key={ingredient.id} className="flex items-center gap-3">
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() =>
                startTransition(() => moveRecipeIngredient(recipeId, ingredient.id, "up"))
              }
              disabled={index === 0}
              aria-label={`Move ${ingredient.name} up`}
              className="text-sm leading-none text-foreground/40 hover:text-foreground/70 disabled:opacity-20"
            >
              &#9650;
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(() => moveRecipeIngredient(recipeId, ingredient.id, "down"))
              }
              disabled={index === ingredients.length - 1}
              aria-label={`Move ${ingredient.name} down`}
              className="text-sm leading-none text-foreground/40 hover:text-foreground/70 disabled:opacity-20"
            >
              &#9660;
            </button>
          </div>
          <input
            type="checkbox"
            name="ingredient"
            value={ingredient.name}
            aria-label={ingredient.name}
            className="h-5 w-5 shrink-0"
          />
          <input
            type="text"
            defaultValue={ingredient.name}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (!name || name === ingredient.name) return;
              const formData = new FormData();
              formData.set("name", name);
              startTransition(() => updateRecipeIngredient(recipeId, ingredient.id, formData));
            }}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-lg hover:border-foreground/10 focus:border-foreground/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => startTransition(() => deleteRecipeIngredient(recipeId, ingredient.id))}
            aria-label={`Remove ${ingredient.name}`}
            className="shrink-0 text-base text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <input
          ref={newInputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add ingredient"
          className="min-w-0 flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !newName.trim()}
          className="shrink-0 rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
