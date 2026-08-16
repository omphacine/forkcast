"use client";

import { useState, useTransition } from "react";
import { updateRecipeRating } from "./actions";

export function RecipeRating({
  recipeId,
  initialRating,
}: {
  recipeId: number;
  initialRating: number | null;
}) {
  const [rating, setRating] = useState(initialRating);
  const [isPending, startTransition] = useTransition();

  function handleClick(value: number) {
    const next = rating === value ? null : value;
    setRating(next);
    startTransition(async () => {
      await updateRecipeRating(recipeId, next);
    });
  }

  return (
    <div className="flex items-center gap-1" aria-label={rating ? `${rating} out of 5 stars` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => handleClick(value)}
          disabled={isPending}
          aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
          className="text-3xl leading-none text-primary disabled:opacity-50"
        >
          {rating !== null && value <= rating ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
