import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { getRecipes, type Recipe } from "./data";
import {
  createRecipe,
  toggleRecipeFavorite,
  updateRecipeCookingMethod,
  updateRecipeMainIngredient,
} from "./actions";
import { ScanRecipeForm } from "./ScanRecipeForm";
import { RecipeCategoryForm } from "./RecipeCategoryForm";

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
      {recipe.photoDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.photoDataUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      )}
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

export default async function RecipesPage() {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">Sign in with Google to see your recipes.</p>
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

  const recipes = await getRecipes(session.appUserId);
  const byMainIngredient = groupBy(recipes, (recipe) => recipe.mainIngredient);
  const byCookingMethod = groupBy(recipes, (recipe) => recipe.cookingMethod);
  const favorites = recipes.filter((recipe) => recipe.favorite);

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

      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-4xl font-semibold">Recipes</h1>
        <Link
          href="/meals"
          className="shrink-0 rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5"
        >
          Meal Planning &rarr;
        </Link>
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
        <h2 className="font-heading text-2xl font-semibold">All Recipes</h2>
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
          <div className="flex flex-wrap gap-3">
            <input
              name="sourceName"
              placeholder="Source: cookbook, website, etc. (optional)"
              className="min-w-[220px] flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
            />
            <input
              name="sourcePage"
              placeholder="Page (optional)"
              className="w-28 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
            />
          </div>
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
