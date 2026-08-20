"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import strideSql from "@/lib/strideDb";
import claude from "@/lib/claude";
import { FAMILY_CALENDAR_ID, eventsUrl, getExtrasAccessToken, googleFetch } from "@/lib/google";
import { getUserId, isOwner } from "@/lib/user";

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

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    instructions: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["name", "ingredients", "instructions"],
  additionalProperties: false,
} as const;

async function extractRecipeFromContent(
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: ScannableImageType; data: string } }
  >,
  notFoundReason: string,
): Promise<ScanRecipeResult> {
  let response;
  try {
    response = await claude.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Scanning failed. Please try again.",
    };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "Claude couldn't process that." };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, reason: "Couldn't read a recipe from that." };
  }

  let parsed: { name: string; ingredients: string[]; instructions: string | null };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return { ok: false, reason: "Couldn't understand what was there." };
  }

  if (!parsed.name?.trim() || parsed.ingredients.length === 0) {
    return { ok: false, reason: notFoundReason };
  }

  return {
    ok: true,
    name: parsed.name.trim(),
    ingredients: parsed.ingredients.map((i) => i.trim()).filter(Boolean),
    instructions: parsed.instructions?.trim() || null,
  };
}

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

  return extractRecipeFromContent(
    [
      {
        type: "image",
        source: { type: "base64", media_type: file.type as ScannableImageType, data: base64 },
      },
      {
        type: "text",
        text: "This is a photo of a recipe — a recipe card, cookbook page, or handwritten note. Read it and extract the recipe name, the full list of ingredients (one per item, keeping quantities as written), and the cooking instructions if visible. If no name is written, invent a short descriptive one. If no instructions are visible, return null for instructions.",
      },
    ],
    "Couldn't find a recipe in that photo — try a clearer picture.",
  );
}

type JsonLdRecipe = { name: string; ingredients: string[]; instructions: string | null };

function parseJsonLdRecipeNode(node: unknown): JsonLdRecipe | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;

  const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
  if (types.includes("Recipe")) {
    const name = String(obj.name ?? "").trim();
    const ingredients = Array.isArray(obj.recipeIngredient)
      ? obj.recipeIngredient.map((i) => String(i).trim()).filter(Boolean)
      : [];
    if (!name || ingredients.length === 0) return null;

    let instructions: string | null = null;
    const raw = obj.recipeInstructions;
    if (Array.isArray(raw)) {
      const steps = raw
        .map((step) => {
          if (typeof step === "string") return step.trim();
          if (step && typeof step === "object" && "text" in step) {
            return String((step as { text: unknown }).text).trim();
          }
          return "";
        })
        .filter(Boolean);
      instructions = steps.length > 0 ? steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : null;
    } else if (typeof raw === "string") {
      instructions = raw.trim() || null;
    }

    return { name, ingredients, instructions };
  }

  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) {
      const found = parseJsonLdRecipeNode(child);
      if (found) return found;
    }
  }

  return null;
}

// Most recipe sites embed schema.org Recipe structured data for Google's rich
// snippets — reading it directly is far more reliable than asking Claude to
// pick a recipe out of a page full of nav/ads/comments/related-posts text.
function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html))) {
    let data: unknown;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      const found = parseJsonLdRecipeNode(node);
      if (found) return found;
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&zwnj;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function scanRecipeUrl(url: string): Promise<ScanRecipeResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http:// and https:// URLs are supported." };
  }

  let html: string;
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ForkCastBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ok: false, reason: `Couldn't load that page (HTTP ${res.status}).` };
    }
    html = await res.text();
  } catch {
    return { ok: false, reason: "Couldn't reach that URL." };
  }

  const structured = extractJsonLdRecipe(html);
  if (structured) {
    return { ok: true, ...structured };
  }

  const bodyText = stripHtml(html).slice(0, 20000);
  if (!bodyText.trim()) {
    return { ok: false, reason: "Couldn't read that page." };
  }

  return extractRecipeFromContent(
    [
      {
        type: "text",
        text: `This is the text content of a recipe web page. Extract the recipe name, the full list of ingredients (one per item, keeping quantities as written), and the cooking instructions if present — ignore navigation, ads, comments, and related-recipe links. If no name is evident, invent a short descriptive one. If no instructions are present, return null for instructions.\n\nPage content:\n${bodyText}`,
      },
    ],
    "Couldn't find a recipe on that page.",
  );
}

export async function createRecipe(formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  const mainIngredient = String(formData.get("mainIngredient") ?? "").trim() || null;
  const cookingMethod = String(formData.get("cookingMethod") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const sourceName = String(formData.get("sourceName") ?? "").trim() || null;
  const sourcePage = String(formData.get("sourcePage") ?? "").trim() || null;
  const ingredientsRaw = String(formData.get("ingredients") ?? "");
  if (!name) throw new Error("Recipe name is required");

  const ingredientLines = ingredientsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const [{ id: recipeId }] = await sql`
    INSERT INTO recipes (user_id, name, main_ingredient, cooking_method, instructions, source_name, source_page)
    VALUES (${userId}, ${name}, ${mainIngredient}, ${cookingMethod}, ${instructions}, ${sourceName}, ${sourcePage})
    RETURNING id
  `;

  for (let i = 0; i < ingredientLines.length; i++) {
    await sql`
      INSERT INTO recipe_ingredients (recipe_id, name, position)
      VALUES (${recipeId}, ${ingredientLines[i]}, ${i})
    `;
  }

  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function updateRecipeName(recipeId: number, formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Recipe name is required");
  await sql`
    UPDATE recipes SET name = ${name} WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
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

export async function updateRecipeSource(recipeId: number, formData: FormData) {
  const userId = await getUserId();
  const sourceName = String(formData.get("sourceName") ?? "").trim() || null;
  const sourcePage = String(formData.get("sourcePage") ?? "").trim() || null;
  await sql`
    UPDATE recipes SET source_name = ${sourceName}, source_page = ${sourcePage}
    WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  revalidatePath(`/recipes/${recipeId}`);
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
  const ingredients = formData.getAll("ingredient").map(String);
  const source = `Recipe: ${recipeName}`;
  const owner = await isOwner();
  const userId = owner ? null : await getUserId();

  for (const ingredient of ingredients) {
    if (owner) {
      await strideSql`
        INSERT INTO shopping_items (name, source) VALUES (${ingredient}, ${source})
      `;
    } else {
      await sql`
        INSERT INTO shopping_items (user_id, name, source)
        VALUES (${userId}, ${ingredient}, ${source})
      `;
    }
  }

  revalidatePath("/shopping");
}

export async function addRecipeIngredient(recipeId: number, formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Ingredient name is required");

  const [owned] = await sql`SELECT id FROM recipes WHERE id = ${recipeId} AND user_id = ${userId}`;
  if (!owned) throw new Error("Recipe not found");

  const [{ maxPosition }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS "maxPosition"
    FROM recipe_ingredients WHERE recipe_id = ${recipeId}
  `;

  await sql`
    INSERT INTO recipe_ingredients (recipe_id, name, position)
    VALUES (${recipeId}, ${name}, ${maxPosition + 1})
  `;

  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeIngredient(
  recipeId: number,
  ingredientId: number,
  formData: FormData,
) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Ingredient name is required");

  await sql`
    UPDATE recipe_ingredients SET name = ${name}
    WHERE id = ${ingredientId}
      AND recipe_id = ${recipeId}
      AND recipe_id IN (SELECT id FROM recipes WHERE user_id = ${userId})
  `;

  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipeIngredient(recipeId: number, ingredientId: number) {
  const userId = await getUserId();

  await sql`
    DELETE FROM recipe_ingredients
    WHERE id = ${ingredientId}
      AND recipe_id = ${recipeId}
      AND recipe_id IN (SELECT id FROM recipes WHERE user_id = ${userId})
  `;

  revalidatePath(`/recipes/${recipeId}`);
}
