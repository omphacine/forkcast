"use client";

import { useTransition, type FormEvent } from "react";
import { planMeal } from "@/app/meals/actions";
import { showToast } from "@/app/showToast";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function PlanMealForm({
  recipeId,
  recipeName,
  defaultDate,
}: {
  recipeId: number;
  recipeName: string;
  defaultDate: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = String(formData.get("date") ?? "");
    const isSide = formData.get("isSide") === "on";
    formData.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    startTransition(async () => {
      await planMeal(recipeId, recipeName, formData);
      showToast(
        isSide ? `Side added to ${formatDate(date)}` : `Meal planned for ${formatDate(date)}`,
      );
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="min-w-0 flex-1 text-base text-foreground/60">
        Date
        <input
          name="date"
          type="date"
          defaultValue={defaultDate}
          required
          className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
        />
      </label>
      <label className="flex shrink-0 items-center gap-2 pb-2 text-base text-foreground/60">
        <input type="checkbox" name="isSide" className="h-5 w-5" />
        Side dish
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add to meal plan"}
      </button>
    </form>
  );
}
