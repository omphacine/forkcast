import sql from "@/lib/db";

export type ShoppingItem = {
  id: number;
  name: string;
  store: string | null;
  completed: boolean;
  source: string | null;
  createdAt: string;
};

export async function getShoppingItems(userId: number): Promise<ShoppingItem[]> {
  const rows = await sql`
    SELECT id, name, store, completed, source, created_at::text AS "createdAt"
    FROM shopping_items
    WHERE NOT completed AND user_id = ${userId}
    ORDER BY store IS NULL, store, created_at
  `;

  return rows as unknown as ShoppingItem[];
}
