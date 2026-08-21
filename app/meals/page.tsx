import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { addDaysToDateStr, getWeekStart, getZonedParts } from "@/lib/google";
import { getWeeklyMealPlan } from "./data";
import { deleteMealPlanEntry, toggleMealSide } from "./actions";
import { EnsureTimeZone } from "./EnsureTimeZone";
import { QuickMealForm } from "./QuickMealForm";

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

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; tz?: string }>;
}) {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">Sign in with Google to plan meals.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/meals" });
          }}
        >
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in with Google
          </button>
        </form>
        <Link href="/" className="text-sm text-foreground/60 underline">
          Back home
        </Link>
      </div>
    );
  }

  const userId = session.appUserId;
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

  const days = await getWeeklyMealPlan(weekStart, userId);

  const prevHref = `/meals?start=${addDaysToDateStr(weekStart, -7)}&tz=${encodeURIComponent(timeZone)}`;
  const nextHref = `/meals?start=${addDaysToDateStr(weekStart, 7)}&tz=${encodeURIComponent(timeZone)}`;
  const todayHref = `/meals?start=${today}&tz=${encodeURIComponent(timeZone)}`;

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
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-heading text-4xl font-semibold">Meal Plan</h1>
          <Link
            href="/recipes"
            className="shrink-0 rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5"
          >
            Recipes &rarr;
          </Link>
        </div>

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
                    <Link href="/recipes" className="text-lg text-foreground/60 underline">
                      Nothing planned
                    </Link>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {day.meals.map((meal) => (
                        <li
                          key={meal.entryId}
                          className="flex items-center justify-between gap-3"
                        >
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
                          <form action={toggleMealSide.bind(null, meal.entryId)}>
                            <input type="hidden" name="timeZone" value={timeZone} />
                            <button
                              type="submit"
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-sm ${
                                meal.isSide
                                  ? "border-secondary text-secondary"
                                  : "border-foreground/10 text-foreground/40 hover:border-foreground/20"
                              }`}
                            >
                              Side
                            </button>
                          </form>
                          <form
                            action={deleteMealPlanEntry.bind(
                              null,
                              meal.entryId,
                              meal.calendarEventId,
                              meal.recipeId,
                            )}
                          >
                            <button
                              type="submit"
                              className="text-base text-red-600 underline hover:text-red-700 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <QuickMealForm today={today} />
      </div>
    </div>
  );
}
