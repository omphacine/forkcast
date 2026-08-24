"use server";

import { revalidatePath } from "next/cache";
import sql from "@/lib/db";
import { isOwner } from "@/lib/user";

export type AddViewerResult = { ok: true } | { ok: false; reason: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addSharedViewer(formData: FormData): Promise<AddViewerResult> {
  if (!(await isOwner())) return { ok: false, reason: "Not allowed." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { ok: false, reason: "Enter a valid email address." };
  if (email === process.env.OWNER_EMAIL?.toLowerCase()) {
    return { ok: false, reason: "That's your own email." };
  }

  const canViewMealPlan = formData.get("mealPlan") === "on";
  const canViewRecipes = formData.get("recipes") === "on";
  if (!canViewMealPlan && !canViewRecipes) {
    return { ok: false, reason: "Check Meal Plan, Recipes, or both." };
  }

  // Re-adding an already-invited email updates their permissions — this
  // doubles as the "edit access" flow, since there's no separate UI for it.
  await sql`
    INSERT INTO shared_viewers (email, can_view_meal_plan, can_view_recipes)
    VALUES (${email}, ${canViewMealPlan}, ${canViewRecipes})
    ON CONFLICT (email) DO UPDATE SET
      can_view_meal_plan = excluded.can_view_meal_plan,
      can_view_recipes = excluded.can_view_recipes
  `;

  revalidatePath("/");
  return { ok: true };
}

export async function removeSharedViewer(viewerId: number) {
  if (!(await isOwner())) return;
  await sql`DELETE FROM shared_viewers WHERE id = ${viewerId}`;
  revalidatePath("/");
}
