"use server";

import { revalidatePath } from "next/cache";
import sql from "@/lib/db";
import { getUserId } from "@/lib/user";

export async function createShoppingItem(formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  const store = String(formData.get("store") ?? "").trim() || null;
  if (!name) throw new Error("Item name is required");

  await sql`INSERT INTO shopping_items (user_id, name, store) VALUES (${userId}, ${name}, ${store})`;
  revalidatePath("/shopping");
}

export async function toggleShoppingItemComplete(itemId: number) {
  const userId = await getUserId();
  await sql`
    UPDATE shopping_items SET completed = NOT completed WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/shopping");
}

export async function updateShoppingItemStore(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const store = String(formData.get("store") ?? "").trim() || null;
  await sql`
    UPDATE shopping_items SET store = ${store} WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/shopping");
}

export async function updateShoppingItemName(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Item name is required");
  await sql`
    UPDATE shopping_items SET name = ${name} WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/shopping");
}

export async function deleteShoppingItem(itemId: number) {
  const userId = await getUserId();
  await sql`DELETE FROM shopping_items WHERE id = ${itemId} AND user_id = ${userId}`;
  revalidatePath("/shopping");
}
