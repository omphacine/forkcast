"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import claude from "@/lib/claude";
import { FAMILY_CALENDAR_ID, eventsUrl, getExtrasAccessToken, googleFetch } from "@/lib/google";
import { getUserId } from "@/lib/user";

const SCANNABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
type ScannableImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type ScanRecipeResult =
  | { ok: true; name: string; ingredients: string[]; instructions: string | null }
  | { ok: false; reason: string };

export async function scanRecipeImage(formData: FormData): Promise<ScanRecipeResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, reason: "Choose a photo first." };
  }
  if (!SCANNABLE_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      reason: `That file type (${file.type || "unknown"}) isn't supported — use a JPEG or PNG photo.`,
    };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  let response;
  try {
    response = await claude.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as ScannableImageType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "This is a photo of a recipe — a recipe card, cookbook page, or handwritten note. Read it and extract the recipe name, the full list of ingredients (one per item, keeping quantities as written), and the cooking instructions if visible. If no name is written, invent a short descriptive one. If no instructions are visible, return null for instructions.",
            },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              ingredients: { type: "array", items: { type: "string" } },
              instructions: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
            required: ["name", "ingredients", "instructions"],
            additionalProperties: false,
          },
        },
      },
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Scanning failed. Please try again.",
    };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "Claude couldn't process that photo. Try a different one." };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, reason: "Couldn't read a recipe from that photo." };
  }

  let parsed: { name: string; ingredients: string[]; instructions: string | null };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return { ok: false, reason: "Couldn't understand what was in that photo." };
  }

  if (!parsed.name?.trim() || parsed.ingredients.length === 0) {
    return { ok: false, reason: "Couldn't find a recipe in that photo — try a clearer picture." };
  }

  return {
    ok: true,
    name: parsed.name.trim(),
    ingredients: parsed.ingredients.map((i) => i.trim()).filter(Boolean),
    instructions: parsed.instructions?.trim() || null,
  };
}

export async function createRecipe(formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  const mainIngredient = String(formData.get("mainIngredient") ?? "").trim() || null;
  const cookingMethod = String(formData.get("cookingMethod") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const ingredientsRaw = String(formData.get("ingredients") ?? "");
  if (!name) throw new Error("Recipe name is required");

  const ingredientLines = ingredientsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const [{ id: recipeId }] = await sql`
    INSERT INTO recipes (user_id, name, main_ingredient, cooking_method, instructions)
    VALUES (${userId}, ${name}, ${mainIngredient}, ${cookingMethod}, ${instructions})
    RETURNING id
  `;

  for (let i = 0; i < ingredientLines.length; i++) {
    await sql`
      INSERT INTO recipe_ingredients (recipe_id, name, position)
      VALUES (${recipeId}, ${ingredientLines[i]}, ${i})
    `;
  }

  revalidatePath("/recipes");
}

export async function updateRecipeMainIngredient(recipeId: number, formData: FormData) {
  const userId = await getUserId();
  const mainIngredient = String(formData.get("mainIngredient") ?? "").trim() || null;
  await sql`
    UPDATE recipes SET main_ingredient = ${mainIngredient}
    WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
}

export async function updateRecipeCookingMethod(recipeId: number, formData: FormData) {
  const userId = await getUserId();
  const cookingMethod = String(formData.get("cookingMethod") ?? "").trim() || null;
  await sql`
    UPDATE recipes SET cooking_method = ${cookingMethod}
    WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
}

export async function toggleRecipeFavorite(recipeId: number) {
  const userId = await getUserId();
  await sql`
    UPDATE recipes SET favorite = NOT favorite WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeNotes(recipeId: number, formData: FormData) {
  const userId = await getUserId();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  await sql`
    UPDATE recipes SET notes = ${notes} WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeRating(recipeId: number, rating: number | null) {
  const userId = await getUserId();
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5");
  }
  await sql`
    UPDATE recipes SET rating = ${rating} WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

// dataUrl is produced client-side (resized/compressed before upload) — capped
// here as a defensive limit against a buggy or malicious client bypassing that.
const MAX_PHOTO_DATA_URL_LENGTH = 3_000_000;

export async function setRecipePhoto(recipeId: number, dataUrl: string) {
  const userId = await getUserId();
  if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
    throw new Error("Invalid photo");
  }
  await sql`
    UPDATE recipes SET photo_data_url = ${dataUrl} WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function removeRecipePhoto(recipeId: number) {
  const userId = await getUserId();
  await sql`
    UPDATE recipes SET photo_data_url = NULL WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipe(recipeId: number) {
  const userId = await getUserId();
  const entries = await sql`
    SELECT calendar_event_id AS "calendarEventId"
    FROM meal_plan_entries
    WHERE recipe_id = ${recipeId} AND user_id = ${userId}
  `;

  const accessToken = await getExtrasAccessToken();
  if (accessToken) {
    for (const entry of entries as unknown as { calendarEventId: string | null }[]) {
      if (!entry.calendarEventId) continue;
      try {
        await googleFetch(
          `${eventsUrl(FAMILY_CALENDAR_ID)}/${entry.calendarEventId}`,
          accessToken,
          { method: "DELETE" },
        );
      } catch {
        // Best-effort: the event may already be gone.
      }
    }
  }

  await sql`DELETE FROM recipes WHERE id = ${recipeId} AND user_id = ${userId}`;
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function addIngredientsToShoppingList(
  recipeName: string,
  formData: FormData,
) {
  const userId = await getUserId();
  const ingredients = formData.getAll("ingredient").map(String);
  const source = `Recipe: ${recipeName}`;

  for (const ingredient of ingredients) {
    await sql`
      INSERT INTO shopping_items (user_id, name, source)
      VALUES (${userId}, ${ingredient}, ${source})
    `;
  }

  revalidatePath("/shopping");
}
