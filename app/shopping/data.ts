import sql from "@/lib/db";
import strideSql from "@/lib/strideDb";
import { getUserId, isOwner } from "@/lib/user";

export type ShoppingItem = {
  id: number;
  name: string;
  store: string | null;
  completed: boolean;
  source: string | null;
  createdAt: string;
};

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  if (await isOwner()) {
    const rows = await strideSql`
      SELECT id, name, store, completed, source, created_at::text AS "createdAt"
      FROM shopping_items
      WHERE NOT completed
      ORDER BY store IS NULL, store, created_at
    `;
    return rows as unknown as ShoppingItem[];
  }

  const userId = await getUserId();
  const rows = await sql`
    SELECT id, name, store, completed, source, created_at::text AS "createdAt"
    FROM shopping_items
    WHERE NOT completed AND user_id = ${userId}
    ORDER BY store IS NULL, store, created_at
  `;
  return rows as unknown as ShoppingItem[];
}
