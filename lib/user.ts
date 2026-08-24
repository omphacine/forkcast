import "server-only";
import { auth } from "@/auth";
import sql from "@/lib/db";

export async function getUserId(): Promise<number> {
  const session = await auth();
  if (!session?.appUserId) throw new Error("Not signed in");
  return session.appUserId;
}

// True only for the app owner's own account — gates the direct-to-Stride
// shopping list reconciliation (and the existing Google extras feature).
export async function isOwner(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === process.env.OWNER_EMAIL;
}

export type SharedAccess = {
  ownerUserId: number;
  ownerEmail: string;
  // Real name from the owner's Google profile when known, else falls back to
  // their email (e.g. before they've signed in again since this was added).
  ownerDisplayName: string;
  canViewMealPlan: boolean;
  canViewRecipes: boolean;
};

// Tells a page what's ADDITIONALLY available to a signed-in caller beyond
// their own account — never a substitute for it. The owner has nothing
// "shared" to them (they own their data outright), so this only ever
// resolves for someone the owner has invited (see shared_viewers, linked in
// auth.ts's jwt callback on sign-in). Returns null if there's nothing shared.
export async function getSharedAccess(): Promise<SharedAccess | null> {
  const session = await auth();
  if (!session?.user?.email || session.user.email === process.env.OWNER_EMAIL) return null;

  const [viewer] = await sql`
    SELECT can_view_meal_plan AS "canViewMealPlan", can_view_recipes AS "canViewRecipes"
    FROM shared_viewers
    WHERE email = ${session.user.email.toLowerCase()} AND user_id IS NOT NULL
  `;
  if (!viewer) return null;

  const [owner] = await sql`SELECT id, name FROM users WHERE email = ${process.env.OWNER_EMAIL}`;
  if (!owner) return null;

  return {
    ownerUserId: owner.id as number,
    ownerEmail: process.env.OWNER_EMAIL!,
    ownerDisplayName: (owner.name as string | null) || process.env.OWNER_EMAIL!,
    canViewMealPlan: viewer.canViewMealPlan as boolean,
    canViewRecipes: viewer.canViewRecipes as boolean,
  };
}
