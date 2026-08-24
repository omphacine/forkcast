import sql from "@/lib/db";

export type SharedViewer = {
  id: number;
  email: string;
  status: "Pending" | "Active";
  canViewMealPlan: boolean;
  canViewRecipes: boolean;
};

export async function getSharedViewers(): Promise<SharedViewer[]> {
  const rows = await sql`
    SELECT id, email, user_id AS "userId",
           can_view_meal_plan AS "canViewMealPlan", can_view_recipes AS "canViewRecipes"
    FROM shared_viewers ORDER BY created_at ASC
  `;
  return (
    rows as unknown as {
      id: number;
      email: string;
      userId: number | null;
      canViewMealPlan: boolean;
      canViewRecipes: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    email: row.email,
    status: row.userId === null ? "Pending" : "Active",
    canViewMealPlan: row.canViewMealPlan,
    canViewRecipes: row.canViewRecipes,
  }));
}
