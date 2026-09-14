import sql from "@/lib/db";

export type InventoryItem = {
  id: number;
  name: string;
  category: string | null;
  location: string | null;
  quantity: string | null;
  expirationDate: string | null;
  restockWhenOut: boolean;
  createdAt: string;
};

export async function getInventoryItems(
  userId: number,
  search?: string,
): Promise<InventoryItem[]> {
  const term = search?.trim();
  const rows = await sql`
    SELECT id, name, category, location, quantity, expiration_date AS "expirationDate",
      restock_when_out AS "restockWhenOut", created_at::text AS "createdAt"
    FROM inventory_items
    WHERE user_id = ${userId}
      AND (${term ?? null}::text IS NULL OR name ILIKE '%' || ${term ?? null} || '%')
    ORDER BY category IS NULL, category, expiration_date IS NULL, expiration_date, name ASC
  `;
  return rows as unknown as InventoryItem[];
}

export type InventoryItemName = { id: number; name: string };

// Lightweight, unfiltered list used to drive client-side type-ahead
// suggestions in the search box — see getRecipeNames for the same pattern.
export async function getInventoryItemNames(userId: number): Promise<InventoryItemName[]> {
  const rows = await sql`
    SELECT id, name FROM inventory_items WHERE user_id = ${userId} ORDER BY name ASC
  `;
  return rows as unknown as InventoryItemName[];
}

export async function getCategories(userId: number): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT category FROM inventory_items
    WHERE category IS NOT NULL AND user_id = ${userId}
    ORDER BY category
  `;
  return (rows as { category: string }[]).map((r) => r.category);
}

export async function getLocations(userId: number): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT location FROM inventory_items
    WHERE location IS NOT NULL AND user_id = ${userId}
    ORDER BY location
  `;
  return (rows as { location: string }[]).map((r) => r.location);
}
