import "server-only";
import { auth } from "@/auth";

export const CALENDAR_API_ROOT = "https://www.googleapis.com/calendar/v3";
export const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1";

// The owner's real family calendar. Only ever used behind an extras-access-token
// check, which only the owner (via the Testing-mode "google-extras" client) can
// ever have — public users never reach the code paths that reference this.
export const FAMILY_CALENDAR_ID = "stewardfamilycalendar@gmail.com";

export function eventsUrl(calendarId: string) {
  return `${CALENDAR_API_ROOT}/calendars/${encodeURIComponent(calendarId)}/events`;
}

// Returns the owner's bonus Calendar/Gmail access token, or null if the signed-in
// user hasn't connected it (true for every public user, and for the owner before
// they've connected it).
export async function getExtrasAccessToken(): Promise<string | null> {
  const session = await auth();
  return session?.extrasAccessToken ?? null;
}

export async function googleFetch(
  url: string,
  accessToken: string,
  init?: RequestInit,
) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    let reason: string | undefined;
    try {
      reason = JSON.parse(body)?.error?.errors?.[0]?.reason;
    } catch {
      // body wasn't JSON; leave reason undefined
    }
    const error = new Error(`Google API error (${res.status}): ${body}`) as Error & {
      status?: number;
      reason?: string;
    };
    error.status = res.status;
    error.reason = reason;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export function addDaysToDateStr(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d + days, 12));
  return anchor.toISOString().slice(0, 10);
}

// Monday of the calendar week containing `dateStr`.
export function getWeekStart(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  const dayOfWeek = anchor.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDaysToDateStr(dateStr, -daysSinceMonday);
}

// Extracts the wall-clock date for `date` as seen in `timeZone`, regardless of
// what timezone this server process runs in.
export function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;

  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    minutesOfDay: hour * 60 + parseInt(map.minute, 10),
  };
}
