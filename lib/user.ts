import "server-only";
import { auth } from "@/auth";

export async function getUserId(): Promise<number> {
  const session = await auth();
  if (!session?.appUserId) throw new Error("Not signed in");
  return session.appUserId;
}
