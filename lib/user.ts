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

// Resolves whose data a signed-in caller should see: the owner sees and can
// edit their own; someone the owner has shared access with (see
// shared_viewers, linked in auth.ts's jwt callback on sign-in) sees the
// owner's data read-only; anyone else falls back to their own private
// account, unchanged from today. Returns null if not signed in.
export async function getEffectiveOwner(): Promise<{ userId: number; readOnly: boolean } | null> {
  const session = await auth();
  if (!session?.appUserId || !session.user?.email) return null;

  if (session.user.email === process.env.OWNER_EMAIL) {
    return { userId: session.appUserId, readOnly: false };
  }

  const [viewer] = await sql`
    SELECT 1 FROM shared_viewers
    WHERE email = ${session.user.email.toLowerCase()} AND user_id IS NOT NULL
  `;
  if (viewer) {
    const [owner] = await sql`SELECT id FROM users WHERE email = ${process.env.OWNER_EMAIL}`;
    if (owner) return { userId: owner.id as number, readOnly: true };
  }

  return { userId: session.appUserId, readOnly: false };
}
