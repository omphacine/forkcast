"use server";

import { revalidatePath } from "next/cache";
import sql from "@/lib/db";
import { FAMILY_CALENDAR_ID, eventsUrl, getExtrasAccessToken, googleFetch } from "@/lib/google";
import { getUserId } from "@/lib/user";

export async function planMeal(
  recipeId: number,
  recipeName: string,
  formData: FormData,
) {
  const userId = await getUserId();
  const date = String(formData.get("date") ?? "");
  const timeZone = String(formData.get("timeZone") || "UTC");
  const isSide = formData.get("isSide") === "on";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Please choose a date");
  }

  // Side dishes don't get their own calendar event. Neither does a main dish
  // unless the owner has connected the bonus calendar/Gmail client — public
  // users' meal plans stay in-app only.
  let calendarEventId: string | null = null;
  if (!isSide) {
    const accessToken = await getExtrasAccessToken();
    if (accessToken) {
      const created = await googleFetch(eventsUrl(FAMILY_CALENDAR_ID), accessToken, {
        method: "POST",
        body: JSON.stringify({
          summary: `Meal: ${recipeName}`,
          start: { dateTime: `${date}T17:00:00`, timeZone },
          end: { dateTime: `${date}T18:00:00`, timeZone },
        }),
      });
      calendarEventId = created.id;
    }
  }

  await sql`
    INSERT INTO meal_plan_entries (user_id, recipe_id, date, calendar_event_id, is_side)
    VALUES (${userId}, ${recipeId}, ${date}, ${calendarEventId}, ${isSide})
  `;

  revalidatePath("/meals");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function addQuickMeal(formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const timeZone = String(formData.get("timeZone") || "UTC");
  const isSide = formData.get("isSide") === "on";
  if (!name) throw new Error("Meal name is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Please choose a date");
  }

  let calendarEventId: string | null = null;
  if (!isSide) {
    const accessToken = await getExtrasAccessToken();
    if (accessToken) {
      const created = await googleFetch(eventsUrl(FAMILY_CALENDAR_ID), accessToken, {
        method: "POST",
        body: JSON.stringify({
          summary: `Meal: ${name}`,
          start: { dateTime: `${date}T17:00:00`, timeZone },
          end: { dateTime: `${date}T18:00:00`, timeZone },
        }),
      });
      calendarEventId = created.id;
    }
  }

  await sql`
    INSERT INTO meal_plan_entries (user_id, name, date, calendar_event_id, is_side)
    VALUES (${userId}, ${name}, ${date}, ${calendarEventId}, ${isSide})
  `;

  revalidatePath("/meals");
}

export async function toggleMealSide(entryId: number, formData: FormData) {
  const userId = await getUserId();
  const timeZone = String(formData.get("timeZone") || "UTC");
  const [entry] = await sql`
    SELECT recipe_id AS "recipeId", name, date, calendar_event_id AS "calendarEventId", is_side AS "isSide"
    FROM meal_plan_entries
    WHERE id = ${entryId} AND user_id = ${userId}
  `;
  if (!entry) return;

  const becomingSide = !entry.isSide;
  const accessToken = await getExtrasAccessToken();

  if (becomingSide) {
    // Losing its calendar event — sides don't get one.
    if (entry.calendarEventId && accessToken) {
      try {
        await googleFetch(`${eventsUrl(FAMILY_CALENDAR_ID)}/${entry.calendarEventId}`, accessToken, {
          method: "DELETE",
        });
      } catch {
        // Best-effort: the event may already be gone.
      }
    }
    await sql`
      UPDATE meal_plan_entries SET is_side = true, calendar_event_id = NULL
      WHERE id = ${entryId} AND user_id = ${userId}
    `;
  } else {
    // Becoming the main dish — gains a calendar event, only for the owner.
    let newCalendarEventId: string | null = null;
    if (accessToken) {
      let recipeName: string | null = null;
      if (entry.recipeId) {
        const [recipe] = await sql`SELECT name FROM recipes WHERE id = ${entry.recipeId}`;
        recipeName = recipe?.name ?? null;
      }
      const summary = `Meal: ${recipeName ?? entry.name}`;
      const created = await googleFetch(eventsUrl(FAMILY_CALENDAR_ID), accessToken, {
        method: "POST",
        body: JSON.stringify({
          summary,
          start: { dateTime: `${entry.date}T17:00:00`, timeZone },
          end: { dateTime: `${entry.date}T18:00:00`, timeZone },
        }),
      });
      newCalendarEventId = created.id;
    }
    await sql`
      UPDATE meal_plan_entries SET is_side = false, calendar_event_id = ${newCalendarEventId}
      WHERE id = ${entryId} AND user_id = ${userId}
    `;
  }

  revalidatePath("/meals");
}

export async function deleteMealPlanEntry(
  entryId: number,
  calendarEventId: string | null,
  recipeId: number | null,
) {
  const userId = await getUserId();
  if (calendarEventId) {
    const accessToken = await getExtrasAccessToken();
    if (accessToken) {
      try {
        await googleFetch(
          `${eventsUrl(FAMILY_CALENDAR_ID)}/${calendarEventId}`,
          accessToken,
          { method: "DELETE" },
        );
      } catch {
        // Best-effort: the event may already be gone.
      }
    }
  }

  await sql`DELETE FROM meal_plan_entries WHERE id = ${entryId} AND user_id = ${userId}`;
  revalidatePath("/meals");
  if (recipeId !== null) revalidatePath(`/recipes/${recipeId}`);
}
