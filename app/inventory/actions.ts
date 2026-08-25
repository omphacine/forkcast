"use server";

import { revalidatePath } from "next/cache";
import sql from "@/lib/db";
import claude from "@/lib/claude";
import { GMAIL_API_ROOT, getExtrasAccessToken, googleFetch } from "@/lib/google";
import { getUserId } from "@/lib/user";
import { addToShoppingList } from "@/app/shopping/actions";
import { getCategories } from "./data";

const SCHNUCKS_QUERY = 'from:rewards.schnucks.com subject:"Your Schnucks Receipt"';

const DEFAULT_CATEGORIES = ["Meat", "Dairy", "Produce", "Frozen vegetables", "Bread", "Pantry"];

const SCANNABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
type ScannableImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function createInventoryItem(formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const quantity = String(formData.get("quantity") ?? "").trim() || null;
  const expirationDate = String(formData.get("expirationDate") ?? "").trim() || null;
  const restockWhenOut = formData.get("restockWhenOut") === "on";
  if (!name) throw new Error("Item name is required");

  await sql`
    INSERT INTO inventory_items (user_id, name, category, location, quantity, expiration_date, restock_when_out)
    VALUES (${userId}, ${name}, ${category}, ${location}, ${quantity}, ${expirationDate}, ${restockWhenOut})
  `;
  revalidatePath("/inventory");
}

export async function toggleInventoryItemRestock(itemId: number) {
  const userId = await getUserId();
  await sql`
    UPDATE inventory_items SET restock_when_out = NOT restock_when_out
    WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/inventory");
}

export async function updateInventoryItemName(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Item name is required");
  await sql`
    UPDATE inventory_items SET name = ${name} WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/inventory");
}

export async function updateInventoryItemCategory(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const category = String(formData.get("category") ?? "").trim() || null;
  await sql`
    UPDATE inventory_items SET category = ${category} WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/inventory");
}

export async function updateInventoryItemLocation(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const location = String(formData.get("location") ?? "").trim() || null;
  await sql`
    UPDATE inventory_items SET location = ${location} WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/inventory");
}

export async function updateInventoryItemQuantity(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const quantity = String(formData.get("quantity") ?? "").trim() || null;
  await sql`
    UPDATE inventory_items SET quantity = ${quantity} WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/inventory");
}

export async function updateInventoryItemExpiration(itemId: number, formData: FormData) {
  const userId = await getUserId();
  const expirationDate = String(formData.get("expirationDate") ?? "").trim() || null;
  await sql`
    UPDATE inventory_items SET expiration_date = ${expirationDate}
    WHERE id = ${itemId} AND user_id = ${userId}
  `;
  revalidatePath("/inventory");
}

export async function deleteInventoryItem(itemId: number) {
  const userId = await getUserId();
  const [deleted] = await sql`
    DELETE FROM inventory_items WHERE id = ${itemId} AND user_id = ${userId}
    RETURNING name, restock_when_out AS "restockWhenOut"
  `;
  if (deleted?.restockWhenOut) {
    await addToShoppingList(deleted.name, "Restock");
  }
  revalidatePath("/inventory");
}

export type ScannedInventoryItem = {
  name: string;
  quantity: string | null;
  category: string | null;
};

export type ScanReceiptResult =
  | { ok: true; items: ScannedInventoryItem[] }
  | { ok: false; reason: string };

function receiptItemSchema(categories: string[]) {
  return {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { anyOf: [{ type: "string" }, { type: "null" }] },
            category: { anyOf: [{ type: "string", enum: categories }, { type: "null" }] },
          },
          required: ["name", "quantity", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  };
}

async function extractInventoryItems(
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: ScannableImageType; data: string } }
  >,
  categories: string[],
  sourceLabel: string,
): Promise<ScanReceiptResult> {
  let response;
  try {
    response = await claude.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
      output_config: {
        format: { type: "json_schema", schema: receiptItemSchema(categories) },
      },
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Scanning failed. Please try again.",
    };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, reason: `Claude couldn't process that ${sourceLabel}.` };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, reason: `Couldn't read items from that ${sourceLabel}.` };
  }

  let parsed: { items: ScannedInventoryItem[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return { ok: false, reason: `Couldn't understand that ${sourceLabel}.` };
  }

  const items = parsed.items
    .map((i) => ({
      name: i.name.trim(),
      quantity: i.quantity?.trim() || null,
      category: i.category?.trim() || null,
    }))
    .filter((i) => i.name);

  if (items.length === 0) {
    return { ok: false, reason: `Couldn't find any items in that ${sourceLabel}.` };
  }

  return { ok: true, items };
}

function categorizeInstruction(categories: string[]) {
  return `Assign each item a category from this household's existing food inventory categories: ${categories.join(", ")}. Pick the closest reasonable match (e.g. cheese/milk/yogurt → Dairy, raw or frozen meat/poultry/fish → Meat, fresh fruit/vegetables → Produce). Only use null if truly nothing fits.`;
}

// Inventory item names get matched word-for-word against recipe ingredient
// names (see app/meals/matchIngredients.ts, used by "Made it" and Cook Now) —
// a name padded with brand/marketing words doesn't just fail to match, it can
// wrongly match an unrelated ingredient that happens to share one of those
// words (e.g. "Betty Crocker Super Moist Butter Recipe Yellow Cake Mix"
// matching a recipe's "butter"). Pare every scanned name down before it ever
// reaches inventory.
const NAME_INSTRUCTION = `Name each item by what it actually is for cooking, not how it's printed or branded on the package — strip the brand and marketing language entirely (e.g. "Betty Crocker Super Moist Butter Recipe Yellow Cake Mix" → "Yellow Cake Mix", "Kraft Shredded Mozzarella Cheese" → "Shredded Mozzarella Cheese", "Barilla Angel Hair Pasta" → "Angel Hair Pasta"). Keep only descriptors that actually change what the ingredient is for a recipe (e.g. "whole wheat", "boneless skinless", "unsalted", "low-fat"), never size or marketing ones (e.g. "Family Size", "Super Moist", "Value Pack", "Original").`;

// Manual receipt entry — available to every signed-in user. Upload a photo of a
// paper receipt, or paste the text of an e-receipt, from any store.
export async function scanReceiptManual(formData: FormData): Promise<ScanReceiptResult> {
  const userId = await getUserId();
  const existingCategories = await getCategories(userId);
  const categories = existingCategories.length > 0 ? existingCategories : DEFAULT_CATEGORIES;

  const photo = formData.get("photo");
  const pastedText = String(formData.get("text") ?? "").trim();

  const instructions = `Extract only actual food/grocery items purchased for cooking or eating — skip store/cashier/phone info, subtotal, tax, total, payment details, coupon lines not attached to a specific item, rewards points summaries, and marketing footer text. Exclude non-food household items (paper goods, cleaning supplies, toiletries) if any appear.

If the exact same item appears more than once (bought more than once), combine into a single entry and set quantity to the total count purchased as a plain number string (e.g. "3"). Otherwise set quantity to the pack size if shown (e.g. "12 oz"), or null if unclear.

${NAME_INSTRUCTION}

${categorizeInstruction(categories)}`;

  if (photo instanceof File && photo.size > 0) {
    if (!SCANNABLE_IMAGE_TYPES.has(photo.type)) {
      return {
        ok: false,
        reason: `That file type (${photo.type || "unknown"}) isn't supported — use a JPEG or PNG photo.`,
      };
    }
    const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
    return extractInventoryItems(
      [
        {
          type: "image",
          source: { type: "base64", media_type: photo.type as ScannableImageType, data: base64 },
        },
        {
          type: "text",
          text: `This is a photo of a grocery store receipt.\n\n${instructions}`,
        },
      ],
      categories,
      "receipt",
    );
  }

  if (pastedText) {
    return extractInventoryItems(
      [
        {
          type: "text",
          text: `This is the pasted text of a grocery store receipt.\n\n${instructions}\n\nReceipt text:\n${pastedText.slice(0, 20000)}`,
        },
      ],
      categories,
      "receipt",
    );
  }

  return { ok: false, reason: "Add a photo or paste the receipt text first." };
}

// A photo of items sitting out (e.g. groceries just unpacked on the counter),
// not a receipt — identifies each item visually instead of reading printed text.
export async function scanCounterPhoto(formData: FormData): Promise<ScanReceiptResult> {
  const userId = await getUserId();
  const existingCategories = await getCategories(userId);
  const categories = existingCategories.length > 0 ? existingCategories : DEFAULT_CATEGORIES;

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, reason: "Choose a photo first." };
  }
  if (!SCANNABLE_IMAGE_TYPES.has(photo.type)) {
    return {
      ok: false,
      reason: `That file type (${photo.type || "unknown"}) isn't supported — use a JPEG or PNG photo.`,
    };
  }

  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const instructions = `This is a photo of grocery/food items sitting out — e.g. on a kitchen counter after shopping — not a receipt. Identify each distinct food item visible in the photo.

For each item, set quantity to the pack size printed on its own packaging if legible (e.g. "16 oz", "1 gallon", "12 count"), or the number of visible units if it's a loose/countable item (e.g. "4" for four apples sitting together), or null if neither is clear.

Ignore any non-food objects that happen to be in frame (utensils, mail, receipts, packaging trash, etc.).

${NAME_INSTRUCTION}

${categorizeInstruction(categories)}`;

  return extractInventoryItems(
    [
      {
        type: "image",
        source: { type: "base64", media_type: photo.type as ScannableImageType, data: base64 },
      },
      { type: "text", text: instructions },
    ],
    categories,
    "photo",
  );
}

// --- Owner-only Gmail import (requires the "google-extras" bonus connection) ---

export type ReceiptEmailSummary = {
  id: string;
  subject: string;
  date: string;
};

export type FindReceiptsResult =
  | { ok: true; receipts: ReceiptEmailSummary[] }
  | { ok: false; reason: string };

export async function findSchnucksReceipts(): Promise<FindReceiptsResult> {
  const accessToken = await getExtrasAccessToken();
  if (!accessToken) {
    return { ok: false, reason: "Gmail import isn't connected." };
  }

  try {
    const params = new URLSearchParams({ q: SCHNUCKS_QUERY, maxResults: "10" });
    const listData = await googleFetch(
      `${GMAIL_API_ROOT}/users/me/messages?${params}`,
      accessToken,
    );
    const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) {
      return { ok: false, reason: "No Schnucks receipt emails found in your inbox." };
    }

    const receipts = await Promise.all(
      ids.map(async (id) => {
        const headerParams = new URLSearchParams({ format: "metadata" });
        headerParams.append("metadataHeaders", "Subject");
        headerParams.append("metadataHeaders", "Date");
        const data = await googleFetch(
          `${GMAIL_API_ROOT}/users/me/messages/${id}?${headerParams}`,
          accessToken,
        );
        const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
        return {
          id,
          subject: headers.find((h) => h.name === "Subject")?.value ?? "Schnucks Receipt",
          date: headers.find((h) => h.name === "Date")?.value ?? "",
        };
      }),
    );

    return { ok: true, receipts };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Couldn't search your email.",
    };
  }
}

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

function collectMimePart(payload: GmailMessagePart, mimeType: string): string | null {
  if (payload.mimeType === mimeType && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  for (const part of payload.parts ?? []) {
    const found = collectMimePart(part, mimeType);
    if (found) return found;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&zwnj;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function scanReceiptEmail(messageId: string): Promise<ScanReceiptResult> {
  const userId = await getUserId();
  const accessToken = await getExtrasAccessToken();
  if (!accessToken) {
    return { ok: false, reason: "Gmail import isn't connected." };
  }

  let bodyText: string;
  try {
    const data = await googleFetch(
      `${GMAIL_API_ROOT}/users/me/messages/${messageId}?format=full`,
      accessToken,
    );
    const plain = collectMimePart(data.payload, "text/plain");
    const html = collectMimePart(data.payload, "text/html");
    bodyText = (plain ?? (html ? stripHtml(html) : "")).slice(0, 20000);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Couldn't read that email.",
    };
  }

  if (!bodyText.trim()) {
    return { ok: false, reason: "Couldn't read the email body." };
  }

  const existingCategories = await getCategories(userId);
  const categories = existingCategories.length > 0 ? existingCategories : DEFAULT_CATEGORIES;

  return extractInventoryItems(
    [
      {
        type: "text",
        text: `This is the text content of a Schnucks grocery store e-receipt email. Each purchased item appears as a block shaped like:
{Item Name}
$price
Price: {quantity}/{unit price}
[optional] Discount: ...
Rewards Points ...

Extract only actual food/grocery items purchased for cooking or eating — skip order number, store, cashier, and phone info, subtotal, tax, total, payment details, coupon lines that aren't attached to a specific item, rewards points summaries, "Healthier Habits" scoring, and marketing footer text. Exclude non-food household items (paper goods, cleaning supplies, toiletries) if any appear.

If the exact same item appears in more than one separate block (bought more than once), combine them into a single entry and set quantity to the total count purchased as a plain number string (e.g. "3"). Otherwise set quantity to the pack size shown in the item name if there is one (e.g. "12 oz"), or null if unclear — drop that size from the name itself once it's captured in quantity.

${NAME_INSTRUCTION}

${categorizeInstruction(categories)}

Email content:
${bodyText}`,
      },
    ],
    categories,
    "receipt",
  );
}

export async function addScannedInventoryItems(formData: FormData) {
  const userId = await getUserId();
  const count = Number(formData.get("count") ?? 0);
  for (let i = 0; i < count; i++) {
    if (formData.get(`include-${i}`) !== "on") continue;
    const name = String(formData.get(`name-${i}`) ?? "").trim();
    if (!name) continue;
    const quantity = String(formData.get(`quantity-${i}`) ?? "").trim() || null;
    const location = String(formData.get(`location-${i}`) ?? "").trim() || null;
    const category = String(formData.get(`category-${i}`) ?? "").trim() || null;
    await sql`
      INSERT INTO inventory_items (user_id, name, category, location, quantity)
      VALUES (${userId}, ${name}, ${category}, ${location}, ${quantity})
    `;
  }
  revalidatePath("/inventory");
}
