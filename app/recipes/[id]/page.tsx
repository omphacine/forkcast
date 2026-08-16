import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { getExtrasAccessToken } from "@/lib/google";
import { getRecipe } from "../data";
import {
  addIngredientsToShoppingList,
  deleteMealPlanEntry,
  deleteRecipe,
  planMeal,
  updateRecipeNotes,
} from "../actions";
import { TimeZoneField } from "../TimeZoneField";
import { RecipeRating } from "../RecipeRating";
import { RecipeNotesForm } from "../RecipeNotesForm";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">Sign in with Google to see this recipe.</p>
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

  const { id } = await params;
  const recipeId = Number(id);
  const recipe = Number.isInteger(recipeId) ? await getRecipe(recipeId, session.appUserId) : undefined;

  if (!recipe) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const hasCalendarSync = Boolean(await getExtrasAccessToken());

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/recipes" className="text-base text-foreground/60 underline">
          &larr; Recipes
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

      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-4xl font-semibold">{recipe.name}</h1>
        <form action={deleteRecipe.bind(null, recipe.id)}>
          <button
            type="submit"
            className="text-base text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            Delete recipe
          </button>
        </form>
      </div>

      <RecipeRating recipeId={recipe.id} initialRating={recipe.rating} />

      {recipe.instructions && (
        <div>
          <h2 className="font-heading text-2xl font-semibold">Instructions</h2>
          <p className="mt-2 whitespace-pre-wrap text-lg text-foreground/80">
            {recipe.instructions}
          </p>
        </div>
      )}

      <div>
        <h2 className="font-heading text-2xl font-semibold">Notes</h2>
        <RecipeNotesForm
          action={updateRecipeNotes.bind(null, recipe.id)}
          defaultValue={recipe.notes}
        />
        <p className="mt-1 text-sm text-foreground/50">
          Modifications, substitutions, or what to try next time. Saves when you click away.
        </p>
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Ingredients</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="mt-2 text-base text-foreground/60">No ingredients listed.</p>
        ) : (
          <form
            action={addIngredientsToShoppingList.bind(null, recipe.name)}
            className="mt-4 flex flex-col gap-3"
          >
            <ul className="flex flex-col gap-2">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="ingredient"
                    value={ingredient.name}
                    defaultChecked
                    id={`ingredient-${ingredient.id}`}
                    className="h-5 w-5 shrink-0"
                  />
                  <label htmlFor={`ingredient-${ingredient.id}`} className="text-lg">
                    {ingredient.name}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="submit"
              className="self-start rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
            >
              Add checked items to shopping list
            </button>
          </form>
        )}
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Plan this meal</h2>
        <form
          action={planMeal.bind(null, recipe.id, recipe.name)}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <TimeZoneField />
          <label className="min-w-0 flex-1 text-base text-foreground/60">
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
            Add to meal plan
          </button>
        </form>
        <p className="mt-2 text-sm text-foreground/50">
          {hasCalendarSync
            ? `Adds a "Meal: ${recipe.name}" (or "Side: ${recipe.name}" if checked) event at 5:00 PM on the family calendar.`
            : "Adds this to your meal plan for that date."}
        </p>

        {recipe.plannedDates.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {recipe.plannedDates.map((planned) => (
              <li
                key={planned.entryId}
                className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 px-4 py-3"
              >
                <p className="text-lg">{formatDate(planned.date)}</p>
                <form
                  action={deleteMealPlanEntry.bind(
                    null,
                    planned.entryId,
                    planned.calendarEventId,
                    recipe.id,
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
}
