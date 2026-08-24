import Link from "next/link";
import { getSharedAccess } from "@/lib/user";
import { getRecipes } from "../data";

export default async function SharedRecipesPage() {
  const access = await getSharedAccess();

  if (!access?.canViewRecipes) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">No recipes have been shared with you.</p>
        <Link href="/" className="text-sm text-foreground/60 underline">
          Back home
        </Link>
      </div>
    );
  }

  const recipes = await getRecipes(access.ownerUserId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <Link href="/" className="text-base text-foreground/60 underline">
          &larr; Home
        </Link>
      </header>

      <div>
        <h1 className="font-heading text-4xl font-semibold">
          {access.ownerDisplayName}&apos;s Recipes
        </h1>
        <p className="mt-1 text-base text-foreground/60">
          Click a recipe to view it, or import it into your own Recipes.
        </p>

        {recipes.length === 0 ? (
          <p className="mt-4 text-base text-foreground/60">No recipes yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {recipes.map((recipe) => (
              <li
                key={recipe.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3 hover:border-primary"
              >
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
                    <p
                      className="text-base text-primary"
                      aria-label={`${recipe.rating} out of 5 stars`}
                    >
                      {"★".repeat(recipe.rating)}
                      <span className="text-foreground/30">{"★".repeat(5 - recipe.rating)}</span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
