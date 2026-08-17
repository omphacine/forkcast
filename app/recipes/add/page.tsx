import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { AddRecipeChooser } from "./AddRecipeChooser";

export default async function AddRecipePage() {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">Sign in with Google to add a recipe.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/recipes/add" });
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

      <h1 className="font-heading text-4xl font-semibold">Add a Recipe</h1>

      <AddRecipeChooser />
    </div>
  );
}
