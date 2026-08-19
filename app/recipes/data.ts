import sql from "@/lib/db";

export type Recipe = {
  id: number;
  name: string;
  mainIngredient: string | null;
  cookingMethod: string | null;
  favorite: boolean;
  ingredientCount: number;
  rating: number | null;
  photoDataUrl: string | null;
  createdAt: string;
};

export type Ingredient = {
  id: number;
  name: string;
};

export type PlannedDate = {
  entryId: number;
  date: string;
  calendarEventId: string | null;
};

export type RecipeWithDetails = {
  id: number;
  name: string;
  mainIngredient: string | null;
  cookingMethod: string | null;
  favorite: boolean;
  instructions: string | null;
  notes: string | null;
  rating: number | null;
  photoDataUrl: string | null;
  sourceName: string | null;
  sourcePage: string | null;
  createdAt: string;
  ingredients: Ingredient[];
  plannedDates: PlannedDate[];
};

export type PublicRecipe = {
  id: number;
  name: string;
  instructions: string | null;
  notes: string | null;
  rating: number | null;
  photoDataUrl: string | null;
  sourceName: string | null;
  sourcePage: string | null;
  ingredients: Ingredient[];
};

export async function getRecipes(userId: number): Promise<Recipe[]> {
  const rows = await sql`
    SELECT
      r.id,
      r.name,
      r.main_ingredient AS "mainIngredient",
      r.cooking_method AS "cookingMethod",
      r.favorite,
      r.rating,
      r.photo_data_url AS "photoDataUrl",
      r.created_at::text AS "createdAt",
      COUNT(ri.id)::int AS "ingredientCount"
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE r.user_id = ${userId}
    GROUP BY r.id
    ORDER BY r.main_ingredient IS NULL, r.main_ingredient, r.name ASC
  `;
  return rows as unknown as Recipe[];
}

export async function getRecipe(
  id: number,
  userId: number,
): Promise<RecipeWithDetails | undefined> {
  const recipeRows = await sql`
    SELECT id, name, main_ingredient AS "mainIngredient", cooking_method AS "cookingMethod",
           favorite, instructions, notes, rating, photo_data_url AS "photoDataUrl",
           source_name AS "sourceName", source_page AS "sourcePage",
           created_at::text AS "createdAt"
    FROM recipes
    WHERE id = ${id} AND user_id = ${userId}
  `;
  const recipe = recipeRows[0] as
    | {
        id: number;
        name: string;
        mainIngredient: string | null;
        cookingMethod: string | null;
        favorite: boolean;
        instructions: string | null;
        notes: string | null;
        rating: number | null;
        photoDataUrl: string | null;
        sourceName: string | null;
        sourcePage: string | null;
        createdAt: string;
      }
    | undefined;
  if (!recipe) return undefined;

  const [ingredients, plannedDates] = await Promise.all([
    sql`
      SELECT id, name FROM recipe_ingredients
      WHERE recipe_id = ${id}
      ORDER BY position ASC, id ASC
    `,
    sql`
      SELECT id AS "entryId", date, calendar_event_id AS "calendarEventId"
      FROM meal_plan_entries
      WHERE recipe_id = ${id} AND user_id = ${userId}
      ORDER BY date ASC
    `,
  ]);

  return {
    ...recipe,
    ingredients: ingredients as unknown as Ingredient[],
    plannedDates: plannedDates as unknown as PlannedDate[],
  };
}

// No user_id scoping — used for the read-only view a recipe link (e.g. from
// a calendar event) opens to when the viewer isn't signed in as the owner.
// Only exposes fields relevant to reading a recipe, nothing account-specific.
export async function getPublicRecipe(id: number): Promise<PublicRecipe | undefined> {
  const recipeRows = await sql`
    SELECT id, name, instructions, notes, rating, photo_data_url AS "photoDataUrl",
           source_name AS "sourceName", source_page AS "sourcePage"
    FROM recipes
    WHERE id = ${id}
  `;
  const recipe = recipeRows[0] as
    | {
        id: number;
        name: string;
        instructions: string | null;
        notes: string | null;
        rating: number | null;
        photoDataUrl: string | null;
        sourceName: string | null;
        sourcePage: string | null;
      }
    | undefined;
  if (!recipe) return undefined;

  const ingredients = await sql`
    SELECT id, name FROM recipe_ingredients
    WHERE recipe_id = ${id}
    ORDER BY position ASC, id ASC
  `;

  return { ...recipe, ingredients: ingredients as unknown as Ingredient[] };
}
