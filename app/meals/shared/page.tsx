import Link from "next/link";
import { signOut } from "@/auth";
import { addDaysToDateStr, getWeekStart, getZonedParts } from "@/lib/google";
import { getSharedAccess } from "@/lib/user";
import { getWeeklyMealPlan } from "../data";
import { EnsureTimeZone } from "./EnsureTimeZone";

function dayLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
    day: date.getDate(),
  };
}

function formatWeekRange(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${addDaysToDateStr(startDate, 6)}T00:00:00`);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function isToday(dateStr: string, todayStr: string) {
  return dateStr === todayStr;
}

export default async function SharedMealsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; tz?: string }>;
}) {
  const access = await getSharedAccess();

  if (!access?.canViewMealPlan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">No meal plan has been shared with you.</p>
        <Link href="/" className="text-sm text-foreground/60 underline">
          Back home
        </Link>
      </div>
    );
  }

  const params = await searchParams;

  if (!params.tz) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EnsureTimeZone />
      </div>
    );
  }

  const timeZone = params.tz;
  const today = getZonedParts(new Date(), timeZone).dateStr;
  const rawStart =
    params.start && /^\d{4}-\d{2}-\d{2}$/.test(params.start) ? params.start : today;
  const weekStart = getWeekStart(rawStart);

  const days = await getWeeklyMealPlan(weekStart, access.ownerUserId);

  const prevHref = `/meals/shared?start=${addDaysToDateStr(weekStart, -7)}&tz=${encodeURIComponent(timeZone)}`;
  const nextHref = `/meals/shared?start=${addDaysToDateStr(weekStart, 7)}&tz=${encodeURIComponent(timeZone)}`;
  const todayHref = `/meals/shared?start=${today}&tz=${encodeURIComponent(timeZone)}`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-base text-foreground/60 underline">
          &larr; Home
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-base text-foreground/60 underline">
            Sign out
          </button>
        </form>
      </header>

      <div>
        <h1 className="font-heading text-4xl font-semibold">
          {access.ownerDisplayName}&apos;s Meal Plan
        </h1>

        <div className="mt-4 flex items-center justify-between rounded-full border border-foreground/10 px-2 py-1">
          <Link href={prevHref} className="rounded-full px-3 py-2 text-lg hover:bg-foreground/5">
            &lsaquo; Prev
          </Link>
          <Link
            href={todayHref}
            className="rounded-full px-3 py-2 text-lg font-medium hover:bg-foreground/5"
          >
            {formatWeekRange(weekStart)}
          </Link>
          <Link href={nextHref} className="rounded-full px-3 py-2 text-lg hover:bg-foreground/5">
            Next &rsaquo;
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {days.map((day) => {
            const label = dayLabel(day.dateStr);
            const isCurrentDay = isToday(day.dateStr, today);
            return (
              <div
                key={day.dateStr}
                className={`flex gap-4 rounded-xl border p-4 ${
                  isCurrentDay ? "border-primary bg-foreground/5" : "border-foreground/10"
                }`}
              >
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-foreground/5 py-2">
                  <span className="text-sm font-medium tracking-wide text-foreground/60">
                    {label.weekday}
                  </span>
                  <span className="text-3xl font-semibold tabular-nums">{label.day}</span>
                </div>

                <div className="min-w-0 flex-1 self-center">
                  {day.meals.length === 0 ? (
                    <p className="text-lg text-foreground/60">Nothing planned</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {day.meals.map((meal) => (
                        <li key={meal.entryId} className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {meal.recipeId !== null ? (
                              <Link href={`/recipes/${meal.recipeId}`}>
                                <p className="truncate text-xl font-medium text-secondary underline">
                                  {meal.recipeName}
                                </p>
                              </Link>
                            ) : (
                              <p className="truncate text-xl font-medium">{meal.recipeName}</p>
                            )}
                          </div>
                          {meal.isSide && (
                            <span className="shrink-0 rounded-full border border-secondary px-2 py-0.5 text-sm text-secondary">
                              Side
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
