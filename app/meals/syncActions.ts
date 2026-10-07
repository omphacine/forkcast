"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { reconcileCalendar, type SyncResult } from "@/lib/calendarSync";
import { extrasStatusOf, getExtrasAccessToken } from "@/lib/google";
import { getUserId, isOwner } from "@/lib/user";

export type SyncCalendarResult = SyncResult | { status: "not-connected" };

function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

// Brings the family calendar in line with the meal plan. Owner-only, like
// everything else that touches the bonus Google connection.
export async function syncCalendar(timeZone: string): Promise<SyncCalendarResult> {
  if (!(await isOwner())) return { status: "not-connected" };

  const status = extrasStatusOf(await auth());
  if (status === "expired") return { status: "expired" };
  const accessToken = await getExtrasAccessToken();
  if (status === "not-connected" || !accessToken) return { status: "not-connected" };

  const result = await reconcileCalendar(await getUserId(), accessToken, validTimeZone(timeZone));

  if (result.status === "ok" && result.created + result.fixed + result.removed > 0) {
    // Re-linked events change the ids baked into the Meal Plan page.
    revalidatePath("/meals");
  }
  return result;
}
