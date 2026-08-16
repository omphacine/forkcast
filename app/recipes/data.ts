import sql from "@/lib/db";
import { addDaysToDateStr, getWeekStart } from "@/lib/google";

export type Recipe = {
  id: number;
  name: string;
  mainIngredient: string | null;
  cookingMethod: string | null;
  favorite: boolean;
  ingredientCount: number;
  rating: number | null;
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
  createdAt: string;
  ingredients: Ingredient[];
  plannedDates: PlannedDate[];
};

export type MealPlanItem = {
  entryId: number;
  recipeId: number | null;
  recipeName: string;
  date: string;
  calendarEventId: string | null;
  isSide: boolean;
};

export type MealPlanDay = {
  dateStr: string;
  meals: MealPlanItem[];
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
           favorite, instructions, notes, rating, created_at::text AS "createdAt"
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

export async function getWeeklyMealPlan(
  startDate: string,
  userId: number,
): Promise<MealPlanDay[]> {
  const weekStart = getWeekStart(startDate);
  const dayStrings = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(weekStart, i));

  const rows = await sql`
    SELECT m.id AS "entryId", m.recipe_id AS "recipeId",
           COALESCE(r.name, m.name) AS "recipeName", m.date,
           m.calendar_event_id AS "calendarEventId", m.is_side AS "isSide"
    FROM meal_plan_entries m
    LEFT JOIN recipes r ON r.id = m.recipe_id
    WHERE m.date BETWEEN ${dayStrings[0]} AND ${dayStrings[6]} AND m.user_id = ${userId}
    ORDER BY m.date ASC, m.is_side ASC, m.created_at ASC
  `;

  const days: MealPlanDay[] = dayStrings.map((dateStr) => ({ dateStr, meals: [] }));
  const dayIndex = new Map(dayStrings.map((d, i) => [d, i]));

  for (const row of rows as unknown as MealPlanItem[]) {
    const idx = dayIndex.get(row.date);
    if (idx === undefined) continue;
    days[idx].meals.push(row);
  }

  return days;
}
