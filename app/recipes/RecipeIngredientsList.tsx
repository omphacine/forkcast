"use client";

import {
  useRef,
  useState,
  useTransition,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from "react";
import {
  addRecipeIngredient,
  deleteRecipeIngredient,
  reorderRecipeIngredients,
  updateRecipeIngredient,
} from "./actions";
import type { Ingredient } from "./data";

function GripHandle(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`shrink-0 touch-none rounded p-2 text-foreground/40 hover:text-foreground/70 active:cursor-grabbing ${props.className ?? ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="5" cy="3" r="1.4" fill="currentColor" />
        <circle cx="11" cy="3" r="1.4" fill="currentColor" />
        <circle cx="5" cy="8" r="1.4" fill="currentColor" />
        <circle cx="11" cy="8" r="1.4" fill="currentColor" />
        <circle cx="5" cy="13" r="1.4" fill="currentColor" />
        <circle cx="11" cy="13" r="1.4" fill="currentColor" />
      </svg>
    </button>
  );
}

// Lives inside the "Add checked items to shopping list" <form> in the parent
// page (the checkboxes need to belong to that form to submit together), so
// every control in here must avoid its own <form> — forms can't nest. Edits,
// adds, and reordering instead call server actions directly.
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

  // Local working order, so a drag reorders instantly instead of waiting on
  // a server round-trip. Resyncs whenever the server sends a fresh list
  // (after an add/remove, or once a reorder has actually saved) — adjusted
  // during render rather than an effect, per React's guidance for state
  // derived from a changing prop.
  const [items, setItems] = useState(ingredients);
  const [prevIngredients, setPrevIngredients] = useState(ingredients);
  if (ingredients !== prevIngredients) {
    setPrevIngredients(ingredients);
    setItems(ingredients);
  }

  const draggingId = useRef<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const [draggingState, setDraggingState] = useState<number | null>(null);

  function rowIdAtY(clientY: number): number | null {
    let closestId: number | null = null;
    let closestDistance = Infinity;
    for (const [id, el] of rowRefs.current) {
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const distance = Math.abs(clientY - midY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = id;
      }
    }
    return closestId;
  }

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>, id: number) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingId.current = id;
    setDraggingState(id);
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (draggingId.current === null) return;
    const overId = rowIdAtY(e.clientY);
    if (overId === null || overId === draggingId.current) return;
    setItems((prev) => {
      const fromIndex = prev.findIndex((i) => i.id === draggingId.current);
      const toIndex = prev.findIndex((i) => i.id === overId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handlePointerUp() {
    if (draggingId.current === null) return;
    draggingId.current = null;
    setDraggingState(null);
    startTransition(() =>
      reorderRecipeIngredients(
        recipeId,
        items.map((i) => i.id),
      ),
    );
  }

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
      {items.map((ingredient) => (
        <div
          key={ingredient.id}
          ref={(el) => {
            if (el) rowRefs.current.set(ingredient.id, el);
            else rowRefs.current.delete(ingredient.id);
          }}
          className={`flex items-center gap-2 rounded-md ${
            draggingState === ingredient.id ? "bg-foreground/5 opacity-70" : ""
          }`}
        >
          <GripHandle
            onPointerDown={(e) => handlePointerDown(e, ingredient.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label={`Drag to reorder ${ingredient.name}`}
          />
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
