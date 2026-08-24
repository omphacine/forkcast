import sql from "@/lib/db";

export type SharedViewer = {
  id: number;
  email: string;
  name: string | null;
  status: "Pending" | "Active";
  canViewMealPlan: boolean;
  canViewRecipes: boolean;
};

export async function getSharedViewers(): Promise<SharedViewer[]> {
  const rows = await sql`
    SELECT sv.id, sv.email, sv.user_id AS "userId", u.name AS "name",
           sv.can_view_meal_plan AS "canViewMealPlan", sv.can_view_recipes AS "canViewRecipes"
    FROM shared_viewers sv
    LEFT JOIN users u ON u.id = sv.user_id
    ORDER BY sv.created_at ASC
  `;
  return (
    rows as unknown as {
      id: number;
      email: string;
      userId: number | null;
      name: string | null;
      canViewMealPlan: boolean;
      canViewRecipes: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.userId === null ? "Pending" : "Active",
    canViewMealPlan: row.canViewMealPlan,
    canViewRecipes: row.canViewRecipes,
  }));
}
