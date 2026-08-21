import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { getMealPlanEntry } from "../../data";
import { getRecipeIngredients } from "../../../recipes/data";
import { getInventoryItems } from "../../../inventory/data";
import { findBestInventoryMatch } from "../../matchIngredients";
import { MadeItForm } from "../../MadeItForm";

export default async function MadeItPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">Sign in with Google to update your inventory.</p>
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

  const { entryId: entryIdParam } = await params;
  const entryId = Number(entryIdParam);
  const entry = Number.isInteger(entryId)
    ? await getMealPlanEntry(entryId, session.appUserId)
    : undefined;

  if (!entry) notFound();

  const ingredients =
    entry.recipeId !== null
      ? await getRecipeIngredients(entry.recipeId, session.appUserId)
      : [];
  const inventoryItems = await getInventoryItems(session.appUserId);
  const bestMatches = ingredients.map((ingredient) =>
    findBestInventoryMatch(ingredient.name, inventoryItems),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/meals" className="text-base text-foreground/60 underline">
          &larr; Meal Plan
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
        <h1 className="font-heading text-4xl font-semibold">Made {entry.recipeName}</h1>
        <p className="mt-2 text-base text-foreground/60">
          Review the ingredients matched against your food inventory, fix anything that looks
          off, then confirm to update what&apos;s on hand.
        </p>
      </div>

      {entry.recipeId === null ? (
        <p className="text-base text-foreground/60">
          This was a quick meal with no recipe attached, so there&apos;s nothing to match
          against your inventory.
        </p>
      ) : (
        <MadeItForm
          ingredients={ingredients}
          inventoryItems={inventoryItems}
          bestMatches={bestMatches}
        />
      )}
    </div>
  );
}
