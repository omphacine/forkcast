import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { getRecipesWithIngredients, type RecipeWithIngredients } from "../recipes/data";
import { getInventoryItems, type InventoryItem } from "../inventory/data";
import { findBestInventoryMatch } from "../meals/matchIngredients";
import { AddMissingForm } from "./AddMissingForm";

// How close to expiring an inventory item has to be to surface its recipes
// under "Use it up".
const EXPIRING_WINDOW_DAYS = 5;

type ExpiringMatch = { name: string; daysUntil: number };

// Every non-staple ingredient, paired with whichever inventory item it
// matched (or null if nothing matched) — lets a recipe card show exactly
// what "on hand" is based on, since the word-overlap matcher can pick a
// wrong item when the real one isn't in inventory (see matchIngredients.ts).
type IngredientMatch = { name: string; matchedName: string | null };

type Match = {
  recipe: RecipeWithIngredients;
  total: number;
  matchedCount: number;
  ingredientMatches: IngredientMatch[];
  missing: string[];
  soonestExpiring: ExpiringMatch | null;
};

// Salt and pepper are assumed to always be on hand — nearly every recipe
// lists them, and flagging them as "missing" is just noise, never useful.
// Recognized regardless of quantity/unit/descriptor ("Salt and pepper, to
// taste", "1/2 tsp kosher salt", "freshly ground black pepper", ...).
const STAPLE_WORDS = new Set(["salt", "pepper"]);
const STAPLE_IGNORED_WORDS = new Set([
  "and", "or", "to", "taste", "a", "an", "the", "of", "plus",
  "black", "white", "kosher", "sea", "table",
  "fresh", "freshly", "ground", "cracked", "coarse", "fine", "coarsely", "finely",
  "pinch", "dash", "tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons",
  "cup", "cups", "oz", "ounce", "ounces",
]);

function isStapleSeasoning(ingredientName: string): boolean {
  const words = ingredientName
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 0 && !STAPLE_IGNORED_WORDS.has(w));
  return words.length > 0 && words.every((w) => STAPLE_WORDS.has(w));
}

function daysUntil(dateStr: string, todayStr: string): number {
  const ms =
    new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

function formatDaysUntil(days: number): string {
  if (days <= 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}

function matchRecipe(
  recipe: RecipeWithIngredients,
  inventory: InventoryItem[],
  todayStr: string,
): Match {
  const itemById = new Map(inventory.map((item) => [item.id, item]));
  const ingredients = recipe.ingredients.filter((i) => !isStapleSeasoning(i.name));
  let matchedCount = 0;
  const missing: string[] = [];
  const ingredientMatches: IngredientMatch[] = [];
  let soonestExpiring: ExpiringMatch | null = null;

  for (const ingredient of ingredients) {
    const matchId = findBestInventoryMatch(ingredient.name, inventory);
    if (matchId === null) {
      missing.push(ingredient.name);
      ingredientMatches.push({ name: ingredient.name, matchedName: null });
      continue;
    }
    matchedCount++;

    const item = itemById.get(matchId);
    ingredientMatches.push({ name: ingredient.name, matchedName: item?.name ?? null });
    if (!item?.expirationDate) continue;
    const days = daysUntil(item.expirationDate, todayStr);
    if (days < 0 || days > EXPIRING_WINDOW_DAYS) continue;
    if (!soonestExpiring || days < soonestExpiring.daysUntil) {
      soonestExpiring = { name: item.name, daysUntil: days };
    }
  }

  return { recipe, total: ingredients.length, matchedCount, ingredientMatches, missing, soonestExpiring };
}

function hasExpiringMatch(
  match: Match,
): match is Match & { soonestExpiring: ExpiringMatch } {
  return match.soonestExpiring !== null;
}

function MatchCard({ match }: { match: Match }) {
  const { recipe, total, matchedCount, missing, soonestExpiring, ingredientMatches } = match;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/recipes/${recipe.id}`} className="min-w-0 flex-1">
          <p className="text-lg font-medium text-secondary underline">{recipe.name}</p>
        </Link>
        <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-sm text-foreground/60">
          {matchedCount}/{total} on hand
        </span>
      </div>

      {soonestExpiring && (
        <p className="text-sm font-medium text-primary">
          Uses {soonestExpiring.name} — {formatDaysUntil(soonestExpiring.daysUntil)}
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-foreground/50 hover:text-foreground/70">
          Show ingredient matches
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {ingredientMatches.map((im, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-foreground/80">{im.name}</span>
              <span className="text-foreground/30">&rarr;</span>
              {im.matchedName ? (
                <span className="text-secondary">{im.matchedName}</span>
              ) : (
                <span className="italic text-foreground/40">not found</span>
              )}
            </li>
          ))}
        </ul>
      </details>

      {missing.length > 0 && <AddMissingForm recipeName={recipe.name} missing={missing} />}
    </li>
  );
}

export default async function CookPage() {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">Sign in with Google to see what you can cook.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/cook" });
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
  const today = new Date().toISOString().slice(0, 10);

  const [recipes, inventory] = await Promise.all([
    getRecipesWithIngredients(userId),
    getInventoryItems(userId),
  ]);

  const matches = recipes
    .filter((recipe) => recipe.ingredients.length > 0)
    .map((recipe) => matchRecipe(recipe, inventory, today))
    .filter((match) => match.total > 0);

  const useItUp = matches
    .filter(hasExpiringMatch)
    .sort((a, b) => a.soonestExpiring.daysUntil - b.soonestExpiring.daysUntil);

  const canMake = matches
    .filter((m) => m.matchedCount > 0)
    .sort((a, b) => {
      const pctA = a.matchedCount / a.total;
      const pctB = b.matchedCount / b.total;
      if (pctB !== pctA) return pctB - pctA;
      return a.missing.length - b.missing.length;
    })
    .slice(0, 15);

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
          <h1 className="font-heading text-4xl font-semibold">Cook Now</h1>
          <Link
            href="/inventory"
            className="shrink-0 rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5"
          >
            Food Inventory &rarr;
          </Link>
        </div>
        <p className="mt-1 text-base text-foreground/60">
          What to make from what you&apos;ve already got.
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="text-base text-foreground/60">
          Add some recipes and inventory items to see suggestions here.
        </p>
      ) : (
        <>
          {useItUp.length > 0 && (
            <div>
              <h2 className="font-heading text-2xl font-semibold">Use it up</h2>
              <p className="mt-1 text-base text-foreground/60">
                Recipes that use something expiring soon.
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {useItUp.map((match) => (
                  <MatchCard key={match.recipe.id} match={match} />
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="font-heading text-2xl font-semibold">What you can make</h2>
            {canMake.length === 0 ? (
              <p className="mt-4 text-base text-foreground/60">
                Nothing matches yet — add more to your inventory or recipes.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {canMake.map((match) => (
                  <MatchCard key={match.recipe.id} match={match} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
