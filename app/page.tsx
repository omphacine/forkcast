import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();
  const isOwner = session?.user?.email === process.env.OWNER_EMAIL;
  const hasExtras = Boolean(session?.extrasAccessToken);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <h1 className="font-heading text-4xl font-semibold">ForkCast</h1>
        <p className="mt-2 text-lg text-foreground/60">
          {session?.user?.email ? `Signed in as ${session.user.email}` : "Not signed in"}
        </p>

        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="mt-2"
          >
            <button type="submit" className="text-base text-foreground/60 underline">
              Sign out
            </button>
          </form>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
            className="mt-4"
          >
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in with Google
            </button>
          </form>
        )}

        {isOwner && !hasExtras && (
          <form
            action={async () => {
              "use server";
              await signIn("google-extras", { redirectTo: "/" });
            }}
            className="mt-4"
          >
            <button
              type="submit"
              className="rounded-full border border-secondary px-5 py-2 text-sm font-medium text-secondary hover:bg-secondary/10"
            >
              Connect Google extras (calendar sync + Gmail import)
            </button>
          </form>
        )}
        {isOwner && hasExtras && (
          <p className="mt-4 text-sm text-secondary">
            Google extras connected — calendar sync and Gmail import are active.
          </p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <ModuleCard
            href="/recipes"
            title="Recipes & Meal Planning"
            description="Plan meals for the week and generate a shopping list from any recipe."
          />
          <ModuleCard
            href="/inventory"
            title="Food Inventory"
            description="Track what's on hand and where, by category — scan a receipt to add items fast."
          />
          <ModuleCard
            href="/shopping"
            title="Shopping List"
            description="Grouped by store; ingredients from recipes show up here automatically."
          />
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <div className="rounded-lg border border-foreground/10 p-5 hover:border-primary">
        <h2 className="font-heading text-lg font-medium">{title}</h2>
        <p className="mt-1 text-base text-foreground/60">{description}</p>
      </div>
    </Link>
  );
}
