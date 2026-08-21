"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { markMealMade } from "./actions";
import { showToast } from "@/app/showToast";
import type { Ingredient } from "../recipes/data";
import type { InventoryItem } from "../inventory/data";

const NO_MATCH = "none";

function IngredientRow({
  index,
  ingredient,
  inventoryItems,
  bestMatchId,
}: {
  index: number;
  ingredient: Ingredient;
  inventoryItems: InventoryItem[];
  bestMatchId: number | null;
}) {
  const [included, setIncluded] = useState(bestMatchId !== null);
  const [selectedId, setSelectedId] = useState<string>(
    bestMatchId !== null ? String(bestMatchId) : NO_MATCH,
  );
  const matchedItem = inventoryItems.find((item) => item.id === Number(selectedId));
  const [quantity, setQuantity] = useState(matchedItem?.quantity ?? "");

  function handleSelectChange(value: string) {
    setSelectedId(value);
    const item = inventoryItems.find((i) => i.id === Number(value));
    setQuantity(item?.quantity ?? "");
    setIncluded(value !== NO_MATCH);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => setIncluded(e.target.checked)}
          disabled={selectedId === NO_MATCH}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{ingredient.name}</p>
          <input type="hidden" name={`included-${index}`} value={included ? "on" : ""} />
          <select
            name={`inventoryItemId-${index}`}
            value={selectedId}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
          >
            <option value={NO_MATCH}>No matching inventory item</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.quantity ? ` (${item.quantity})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      {selectedId !== NO_MATCH && (
        <label className="pl-8 text-sm text-foreground/60">
          Leftover quantity (blank = used it all, removes it from inventory)
          <input
            type="text"
            name={`quantity-${index}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 8 Oz"
            className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-2 py-1 text-base"
          />
        </label>
      )}
    </li>
  );
}

export function MadeItForm({
  ingredients,
  inventoryItems,
  bestMatches,
}: {
  ingredients: Ingredient[];
  inventoryItems: InventoryItem[];
  bestMatches: (number | null)[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("count", String(ingredients.length));
    startTransition(async () => {
      await markMealMade(formData);
      showToast("Inventory updated");
      router.push("/meals");
    });
  }

  if (ingredients.length === 0) {
    return <p className="text-base text-foreground/60">This recipe has no ingredients listed.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {ingredients.map((ingredient, i) => (
          <IngredientRow
            key={ingredient.id}
            index={i}
            ingredient={ingredient}
            inventoryItems={inventoryItems}
            bestMatchId={bestMatches[i]}
          />
        ))}
      </ul>
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Updating…" : "Confirm and update inventory"}
      </button>
    </form>
  );
}
