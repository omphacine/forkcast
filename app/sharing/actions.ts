"use server";

import { revalidatePath } from "next/cache";
import sql from "@/lib/db";
import { isOwner } from "@/lib/user";

export type AddViewerResult = { ok: true } | { ok: false; reason: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addSharedViewer(formData: FormData): Promise<AddViewerResult> {
  if (!(await isOwner())) return { ok: false, reason: "Not allowed." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { ok: false, reason: "Enter a valid email address." };
  if (email === process.env.OWNER_EMAIL?.toLowerCase()) {
    return { ok: false, reason: "That's your own email." };
  }

  await sql`
    INSERT INTO shared_viewers (email) VALUES (${email})
    ON CONFLICT (email) DO NOTHING
  `;

  revalidatePath("/");
  return { ok: true };
}

export async function removeSharedViewer(viewerId: number) {
  if (!(await isOwner())) return;
  await sql`DELETE FROM shared_viewers WHERE id = ${viewerId}`;
  revalidatePath("/");
}
