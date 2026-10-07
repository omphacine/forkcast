import "server-only";
import sql from "@/lib/db";
import {
  FAMILY_CALENDAR_ID,
  FORKCAST_EVENT_FIELDS,
  addDaysToDateStr,
  eventsUrl,
  getZonedParts,
  googleFetch,
  siteUrl,
} from "@/lib/google";

type CalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

type PlanEntry = {
  id: number;
  recipeId: number | null;
  name: string;
  date: string;
  isSide: boolean;
  calendarEventId: string | null;
};

export type SyncResult =
  | { status: "ok"; created: number; fixed: number; removed: number; failed: number; more: boolean }
  | { status: "expired" }
  | { status: "error"; message: string };

const PAST_DAYS = 7;
const FUTURE_DAYS = 90;
// Bounds one run's Google calls so a big backlog can't blow a server action's
// time limit; the caller just runs again while `more` is true.
const MAX_WRITES_PER_RUN = 20;

type GoogleError = Error & { status?: number; reason?: string };

function isAuthFailure(err: unknown): boolean {
  const e = err as GoogleError;
  return e.status === 401 || (e.status === 403 && e.reason === "insufficientPermissions");
}

// Events ForkCast made carry a private marker. Older ones predate it, but
// every recipe-based one links back to its recipe page — together that's
// enough to recognise our own events without ever touching the rest of the
// family calendar.
function isForkcastEvent(event: CalendarEvent): boolean {
  if (event.extendedProperties?.private?.forkcast === "1") return true;
  return (
    /^(Meal|Side): /.test(event.summary ?? "") &&
    /^https?:\/\/\S+\/recipes\/\d+$/.test((event.description ?? "").trim())
  );
}

function eventDate(event: CalendarEvent): string | undefined {
  return event.start?.dateTime?.slice(0, 10) ?? event.start?.date;
}

async function listEvents(
  accessToken: string,
  startDate: string,
  endDate: string,
  timeZone: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      timeMin: `${addDaysToDateStr(startDate, -1)}T00:00:00Z`,
      timeMax: `${addDaysToDateStr(endDate, 2)}T00:00:00Z`,
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "250",
      timeZone,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetch(`${eventsUrl(FAMILY_CALENDAR_ID)}?${params}`, accessToken);
    events.push(...((data?.items ?? []) as CalendarEvent[]));
    pageToken = data?.nextPageToken;
    if (!pageToken) break;
  }
  return events;
}

// Events the plan points at but that fell outside the listed window (moved by
// hand, say) — fetch directly rather than assuming they're gone.
async function getEvent(accessToken: string, eventId: string): Promise<CalendarEvent | undefined> {
  try {
    const event = (await googleFetch(
      `${eventsUrl(FAMILY_CALENDAR_ID)}/${eventId}`,
      accessToken,
    )) as CalendarEvent;
    return event.status === "cancelled" ? undefined : event;
  } catch (err) {
    const status = (err as GoogleError).status;
    if (status === 404 || status === 410) return undefined;
    throw err;
  }
}

// Makes the family calendar match the user's meal plan for the next few
// months: recreates events that were never made or have been deleted, fixes
// ones whose title or day drifted, and removes ForkCast-made events whose
// meal is no longer on the plan. Anything not recognisably ForkCast's is left
// alone.
export async function reconcileCalendar(
  userId: number,
  accessToken: string,
  timeZone: string,
): Promise<SyncResult> {
  const today = getZonedParts(new Date(), timeZone).dateStr;
  const windowStart = addDaysToDateStr(today, -PAST_DAYS);
  const windowEnd = addDaysToDateStr(today, FUTURE_DAYS);

  try {
    const entries = (await sql`
      SELECT m.id, m.recipe_id AS "recipeId", COALESCE(r.name, m.name) AS name,
             m.date::text AS date, m.is_side AS "isSide",
             m.calendar_event_id AS "calendarEventId"
      FROM meal_plan_entries m
      LEFT JOIN recipes r ON r.id = m.recipe_id
      WHERE m.user_id = ${userId} AND m.date BETWEEN ${windowStart} AND ${windowEnd}
      ORDER BY m.date ASC, m.id ASC
    `) as unknown as PlanEntry[];

    // Every event any of this user's entries points at, in or out of the
    // window — so nothing still in use can be mistaken for an orphan.
    const claimedRows = (await sql`
      SELECT calendar_event_id AS id FROM meal_plan_entries
      WHERE user_id = ${userId} AND calendar_event_id IS NOT NULL
    `) as unknown as { id: string }[];
    const claimed = new Set(claimedRows.map((r) => r.id));

    const events = await listEvents(accessToken, windowStart, windowEnd, timeZone);
    const byId = new Map(events.map((e) => [e.id, e]));

    // Our own events nothing points at: candidates to re-adopt (so a
    // missing link doesn't mean delete-then-recreate) and, failing that,
    // orphans to remove.
    const unclaimed = events.filter((e) => isForkcastEvent(e) && !claimed.has(e.id));

    let created = 0;
    let fixed = 0;
    let removed = 0;
    let failed = 0;
    let writes = 0;
    let more = false;

    for (const entry of entries) {
      if (writes >= MAX_WRITES_PER_RUN) {
        more = true;
        break;
      }

      const summary = `${entry.isSide ? "Side" : "Meal"}: ${entry.name}`;
      const description = entry.recipeId ? siteUrl(`/recipes/${entry.recipeId}`) : undefined;
      const startEnd = {
        start: { dateTime: `${entry.date}T17:00:00`, timeZone },
        end: { dateTime: `${entry.date}T18:00:00`, timeZone },
      };

      try {
        let event: CalendarEvent | undefined;
        if (entry.calendarEventId) {
          event =
            byId.get(entry.calendarEventId) ?? (await getEvent(accessToken, entry.calendarEventId));
          if (event?.status === "cancelled") event = undefined;
        }

        if (event) {
          const wrongDay = eventDate(event) !== entry.date;
          const wrongTitle = event.summary !== summary;
          const wrongLink = description !== undefined && event.description?.trim() !== description;
          if (wrongDay || wrongTitle || wrongLink) {
            writes++;
            await googleFetch(`${eventsUrl(FAMILY_CALENDAR_ID)}/${event.id}`, accessToken, {
              method: "PATCH",
              body: JSON.stringify({
                summary,
                ...(description ? { description } : {}),
                ...(wrongDay ? startEnd : {}),
                ...FORKCAST_EVENT_FIELDS,
              }),
            });
            fixed++;
          }
          continue;
        }

        const adoptable = unclaimed.findIndex(
          (e) => e.summary === summary && eventDate(e) === entry.date,
        );
        if (adoptable !== -1) {
          const [adopted] = unclaimed.splice(adoptable, 1);
          claimed.add(adopted.id);
          await sql`
            UPDATE meal_plan_entries SET calendar_event_id = ${adopted.id}
            WHERE id = ${entry.id} AND user_id = ${userId}
          `;
          fixed++;
          continue;
        }

        writes++;
        const made = await googleFetch(eventsUrl(FAMILY_CALENDAR_ID), accessToken, {
          method: "POST",
          body: JSON.stringify({
            summary,
            ...(description ? { description } : {}),
            ...startEnd,
            ...FORKCAST_EVENT_FIELDS,
          }),
        });
        claimed.add(made.id);
        await sql`
          UPDATE meal_plan_entries SET calendar_event_id = ${made.id}
          WHERE id = ${entry.id} AND user_id = ${userId}
        `;
        created++;
      } catch (err) {
        if (isAuthFailure(err)) throw err;
        failed++;
      }
    }

    // Orphans are only safe to judge once every entry has had its turn.
    if (!more) {
      for (const orphan of unclaimed) {
        if (writes >= MAX_WRITES_PER_RUN) {
          more = true;
          break;
        }
        const date = eventDate(orphan);
        if (!date || date < windowStart || date > windowEnd) continue;
        try {
          writes++;
          await googleFetch(`${eventsUrl(FAMILY_CALENDAR_ID)}/${orphan.id}`, accessToken, {
            method: "DELETE",
          });
          removed++;
        } catch (err) {
          if (isAuthFailure(err)) throw err;
          failed++;
        }
      }
    }

    return { status: "ok", created, fixed, removed, failed, more };
  } catch (err) {
    if (isAuthFailure(err)) return { status: "expired" };
    return { status: "error", message: err instanceof Error ? err.message : "Sync failed." };
  }
}
