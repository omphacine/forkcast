import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getExtrasAccessToken } from "@/lib/google";
import { getPublicRecipe, getRecipe } from "../data";
import {
  addIngredientsToShoppingList,
  deleteRecipe,
  removeRecipePhoto,
  setRecipePhoto,
  updateRecipeName,
  updateRecipeNotes,
  updateRecipeSource,
} from "../actions";
import { deleteMealPlanEntry } from "@/app/meals/actions";
import { RecipeRating } from "../RecipeRating";
import { RecipeNotesForm } from "../RecipeNotesForm";
import { RecipePhotoForm } from "../RecipePhotoForm";
import { RecipeNameForm } from "../RecipeNameForm";
import { RecipeSourceForm } from "../RecipeSourceForm";
import { RecipeIngredientsList } from "../RecipeIngredientsList";
import { PlanMealForm } from "../PlanMealForm";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// A recipe's source is free text (cookbook, website, etc.) — only treat it as
// a link when it's actually a full http(s) URL, not just any string.
function sourceUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function SourceLink({ sourceName }: { sourceName: string | null }) {
  const link = sourceUrl(sourceName);
  if (!link) return null;
  return (
    <a
      href={link.toString()}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-block text-base text-secondary underline"
    >
      {link.hostname} &#8599;
    </a>
  );
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const session = await auth();
  const recipe = session?.appUserId ? await getRecipe(recipeId, session.appUserId) : undefined;

  if (!recipe) {
    // Not signed in, or signed in as someone other than the recipe's owner
    // (e.g. a family member opening the link from a shared calendar event) —
    // fall back to a read-only view instead of a hard 404, unless the recipe
    // genuinely doesn't exist.
    const publicRecipe = await getPublicRecipe(recipeId);
    if (!publicRecipe) notFound();
    const publicSourceLink = sourceUrl(publicRecipe.sourceName);

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
        <header>
          <Link href="/" className="text-base text-foreground/60 underline">
            &larr; ForkCast
          </Link>
        </header>

        <div>
          <h1 className="font-heading text-4xl font-semibold">{publicRecipe.name}</h1>
          {publicRecipe.rating && (
            <p
              className="mt-2 text-2xl text-primary"
              aria-label={`${publicRecipe.rating} out of 5 stars`}
            >
              {"★".repeat(publicRecipe.rating)}
              <span className="text-foreground/30">{"★".repeat(5 - publicRecipe.rating)}</span>
            </p>
          )}
        </div>

        {publicRecipe.photoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicRecipe.photoDataUrl}
            alt=""
            className="w-full rounded-lg object-cover"
          />
        )}

        {publicRecipe.sourceName && (
          <div>
            <h2 className="font-heading text-2xl font-semibold">Source</h2>
            {publicSourceLink ? (
              <SourceLink sourceName={publicRecipe.sourceName} />
            ) : (
              <p className="mt-1 text-lg text-foreground/80">
                {publicRecipe.sourceName}
                {publicRecipe.sourcePage && `, p. ${publicRecipe.sourcePage}`}
              </p>
            )}
          </div>
        )}

        {publicRecipe.instructions && (
          <div>
            <h2 className="font-heading text-2xl font-semibold">Instructions</h2>
            <p className="mt-2 whitespace-pre-wrap text-lg text-foreground/80">
              {publicRecipe.instructions}
            </p>
          </div>
        )}

        {publicRecipe.notes && (
          <div>
            <h2 className="font-heading text-2xl font-semibold">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-lg text-foreground/80">
              {publicRecipe.notes}
            </p>
          </div>
        )}

        <div>
          <h2 className="font-heading text-2xl font-semibold">Ingredients</h2>
          {publicRecipe.ingredients.length === 0 ? (
            <p className="mt-2 text-base text-foreground/60">No ingredients listed.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {publicRecipe.ingredients.map((ingredient) => (
                <li key={ingredient.id} className="text-lg text-foreground/80">
                  {ingredient.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-base text-foreground/60">
          <Link href="/recipes" className="text-secondary underline">
            Sign in
          </Link>{" "}
          to save this to your own recipes or add it to your meal plan.
        </p>
      </div>
    );
  }

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

      <div className="flex flex-col gap-2">
        <RecipeNameForm action={updateRecipeName.bind(null, recipe.id)} defaultValue={recipe.name} />
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

      <RecipePhotoForm
        photoDataUrl={recipe.photoDataUrl}
        onUpload={setRecipePhoto.bind(null, recipe.id)}
        onRemove={removeRecipePhoto.bind(null, recipe.id)}
      />

      <div>
        <h2 className="font-heading text-2xl font-semibold">Source</h2>
        <div className="mt-2">
          <RecipeSourceForm
            action={updateRecipeSource.bind(null, recipe.id)}
            defaultName={recipe.sourceName}
            defaultPage={recipe.sourcePage}
          />
        </div>
        <SourceLink sourceName={recipe.sourceName} />
      </div>

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
        <form
          action={addIngredientsToShoppingList.bind(null, recipe.name)}
          className="mt-4 flex flex-col gap-3"
        >
          <RecipeIngredientsList recipeId={recipe.id} ingredients={recipe.ingredients} />
          {recipe.ingredients.length > 0 && (
            <button
              type="submit"
              className="self-start rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
            >
              Add checked items to shopping list
            </button>
          )}
        </form>
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Plan this meal</h2>
        <PlanMealForm recipeId={recipe.id} recipeName={recipe.name} today={today} />
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
