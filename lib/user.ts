import "server-only";
import { auth } from "@/auth";

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
