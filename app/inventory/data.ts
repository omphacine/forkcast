import sql from "@/lib/db";

export type InventoryItem = {
  id: number;
  name: string;
  category: string | null;
  location: string | null;
  quantity: string | null;
  expirationDate: string | null;
  createdAt: string;
};

export async function getInventoryItems(userId: number): Promise<InventoryItem[]> {
  const rows = await sql`
    SELECT id, name, category, location, quantity, expiration_date AS "expirationDate",
      created_at::text AS "createdAt"
    FROM inventory_items
    WHERE user_id = ${userId}
    ORDER BY category IS NULL, category, expiration_date IS NULL, expiration_date, name ASC
  `;
  return rows as unknown as InventoryItem[];
}

export async function getCategories(userId: number): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT category FROM inventory_items
    WHERE category IS NOT NULL AND user_id = ${userId}
    ORDER BY category
  `;
  return (rows as { category: string }[]).map((r) => r.category);
}
