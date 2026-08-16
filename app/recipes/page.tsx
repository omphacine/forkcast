import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { addDaysToDateStr, getWeekStart, getZonedParts } from "@/lib/google";
import { getRecipes, getWeeklyMealPlan, type Recipe } from "./data";
import {
  addQuickMeal,
  createRecipe,
  deleteMealPlanEntry,
  toggleMealSide,
  toggleRecipeFavorite,
  updateRecipeCookingMethod,
  updateRecipeMainIngredient,
} from "./actions";
import { ScanRecipeForm } from "./ScanRecipeForm";
import { RecipeCategoryForm } from "./RecipeCategoryForm";
import { EnsureTimeZone } from "./EnsureTimeZone";

const UNCATEGORIZED = "Uncategorized";

function groupBy(recipes: Recipe[], getKey: (recipe: Recipe) => string | null) {
  const groups = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    const key = getKey(recipe) ?? UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(recipe);
  }
  return Array.from(groups.entries());
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3 hover:border-primary">
      <Link href={`/recipes/${recipe.id}`} className="min-w-[180px] flex-1">
        <p className="truncate text-lg font-medium">{recipe.name}</p>
        {recipe.rating && (
          <p className="text-base text-primary" aria-label={`${recipe.rating} out of 5 stars`}>
            {"★".repeat(recipe.rating)}
            <span className="text-foreground/30">{"★".repeat(5 - recipe.rating)}</span>
          </p>
        )}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <form action={toggleRecipeFavorite.bind(null, recipe.id)}>
          <button
            type="submit"
            aria-label={recipe.favorite ? "Unfavorite recipe" : "Favorite recipe"}
            className={`text-2xl leading-none ${
              recipe.favorite ? "text-primary" : "text-foreground/25 hover:text-foreground/50"
            }`}
          >
            {recipe.favorite ? "★" : "☆"}
          </button>
        </form>
        <RecipeCategoryForm
          action={updateRecipeMainIngredient.bind(null, recipe.id)}
          defaultValue={recipe.mainIngredient}
          fieldName="mainIngredient"
          placeholder="Main ingredient"
        />
        <RecipeCategoryForm
          action={updateRecipeCookingMethod.bind(null, recipe.id)}
          defaultValue={recipe.cookingMethod}
          fieldName="cookingMethod"
          placeholder="Cooking method"
        />
      </div>
    </li>
  );
}

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

export default async function RecipesPage({
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
            await signIn("google", { redirectTo: "/recipes" });
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

  const [days, recipes] = await Promise.all([
    getWeeklyMealPlan(weekStart, userId),
    getRecipes(userId),
  ]);
  const byMainIngredient = groupBy(recipes, (recipe) => recipe.mainIngredient);
  const byCookingMethod = groupBy(recipes, (recipe) => recipe.cookingMethod);
  const favorites = recipes.filter((recipe) => recipe.favorite);

  const prevHref = `/recipes?start=${addDaysToDateStr(weekStart, -7)}&tz=${encodeURIComponent(timeZone)}`;
  const nextHref = `/recipes?start=${addDaysToDateStr(weekStart, 7)}&tz=${encodeURIComponent(timeZone)}`;
  const todayHref = `/recipes?start=${today}&tz=${encodeURIComponent(timeZone)}`;

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
          <h1 className="font-heading text-4xl font-semibold">Recipes &amp; Meal Planning</h1>
          <Link
            href="/inventory"
            className="shrink-0 rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5"
          >
            Inventory &rarr;
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
                    <p className="text-lg text-foreground/60">Nothing planned</p>
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

        <form
          action={addQuickMeal}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="timeZone" value={timeZone} />
          <label className="min-w-0 flex-1 text-base text-foreground/60">
            Quick meal (no recipe needed)
            <input
              name="name"
              placeholder="e.g. Tacos"
              required
              className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
            />
          </label>
          <label className="text-base text-foreground/60">
            Date
            <input
              name="date"
              type="date"
              defaultValue={today}
              required
              className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
            />
          </label>
          <label className="flex shrink-0 items-center gap-2 pb-2 text-base text-foreground/60">
            <input type="checkbox" name="isSide" className="h-5 w-5" />
            Side dish
          </label>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
          >
            Add
          </button>
        </form>
      </div>

      {favorites.length > 0 && (
        <div>
          <h2 className="font-heading text-2xl font-semibold">Favorites</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {favorites.map((recipe) => (
              <RecipeRow key={recipe.id} recipe={recipe} />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-heading text-2xl font-semibold">Recipes</h2>
        {recipes.length === 0 ? (
          <p className="mt-4 text-base text-foreground/60">No recipes yet.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground/70">By Main Ingredient</h3>
              <div className="mt-3 flex flex-col gap-3">
                {byMainIngredient.map(([group, groupRecipes]) => (
                  <details key={group} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 font-heading text-xl font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="text-foreground/40 transition-transform group-open:rotate-90">
                        &rsaquo;
                      </span>
                      {group}
                      <span className="text-base font-normal text-foreground/40">
                        ({groupRecipes.length})
                      </span>
                    </summary>
                    <ul className="mt-2 flex flex-col gap-3">
                      {groupRecipes.map((recipe) => (
                        <RecipeRow key={recipe.id} recipe={recipe} />
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground/70">By Cooking Method</h3>
              <div className="mt-3 flex flex-col gap-3">
                {byCookingMethod.map(([group, groupRecipes]) => (
                  <details key={group} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 font-heading text-xl font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="text-foreground/40 transition-transform group-open:rotate-90">
                        &rsaquo;
                      </span>
                      {group}
                      <span className="text-base font-normal text-foreground/40">
                        ({groupRecipes.length})
                      </span>
                    </summary>
                    <ul className="mt-2 flex flex-col gap-3">
                      {groupRecipes.map((recipe) => (
                        <RecipeRow key={recipe.id} recipe={recipe} />
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Scan a recipe</h2>
        <div className="mt-4">
          <ScanRecipeForm />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Add recipe</h2>
        <form action={createRecipe} className="mt-4 flex flex-col gap-3">
          <input
            name="name"
            placeholder="Recipe name"
            required
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="mainIngredient"
            placeholder="Main ingredient (optional)"
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="cookingMethod"
            placeholder="Cooking method (optional)"
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <label className="text-base text-foreground/60">
            Ingredients (one per line)
            <textarea
              name="ingredients"
              rows={5}
              placeholder={"2 cups flour\n1 tsp salt\n..."}
              className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
            />
          </label>
          <label className="text-base text-foreground/60">
            Instructions (optional)
            <textarea
              name="instructions"
              rows={4}
              className="mt-1 block w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
