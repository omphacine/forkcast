import sql from "@/lib/db";
import { addDaysToDateStr, getWeekStart } from "@/lib/google";

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
