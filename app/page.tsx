import Image from "next/image";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { getSharedAccess } from "@/lib/user";
import { getSharedViewers } from "@/app/sharing/data";
import { removeSharedViewer } from "@/app/sharing/actions";
import { AddViewerForm } from "@/app/sharing/AddViewerForm";

export default async function Home() {
  const session = await auth();
  const isOwner = session?.user?.email === process.env.OWNER_EMAIL;
  const hasExtras = Boolean(session?.extrasAccessToken);
  const sharedAccess = session?.appUserId ? await getSharedAccess() : null;
  const sharedViewers = isOwner ? await getSharedViewers() : [];

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <Image
            src="/forkcast-mark.png"
            alt=""
            width={48}
            height={48}
            className="rounded-[10px]"
            priority
          />
          <h1 className="font-heading text-4xl font-semibold">ForkCast</h1>
        </div>
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
            href="/meals"
            title="Meal Plan"
            description="Plan meals for the week and generate a shopping list from any recipe."
          />
          <ModuleCard
            href="/recipes"
            title="Recipes"
            description="Your recipe library — scan, rate, and organize by ingredient or cooking method."
          />
          <ModuleCard
            href="/shopping"
            title="Shopping List"
            description="Grouped by store; ingredients from recipes show up here automatically."
          />
          <ModuleCard
            href="/inventory"
            title="Food Inventory"
            description="Track what's on hand and where, by category — scan a receipt to add items fast."
          />
        </div>

        {sharedAccess && (sharedAccess.canViewMealPlan || sharedAccess.canViewRecipes) && (
          <div className="mt-8 rounded-lg border border-foreground/10 p-5">
            <h2 className="font-heading text-lg font-medium">Shared with you</h2>
            <p className="mt-1 text-base text-foreground/60">{sharedAccess.ownerEmail}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {sharedAccess.canViewMealPlan && (
                <Link
                  href="/meals/shared"
                  className="rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5"
                >
                  View Meal Plan
                </Link>
              )}
              {sharedAccess.canViewRecipes && (
                <Link
                  href="/recipes/shared"
                  className="rounded-full border border-foreground/10 px-4 py-2 text-base hover:bg-foreground/5"
                >
                  View Recipes
                </Link>
              )}
            </div>
          </div>
        )}

        {isOwner && (
          <div className="mt-8 rounded-lg border border-foreground/10 p-5">
            <h2 className="font-heading text-lg font-medium">Shared viewers</h2>
            <p className="mt-1 text-base text-foreground/60">
              People you add here can sign in with Google to see your Meal Plan and/or Recipes,
              read-only, alongside their own — nothing of theirs is affected.
            </p>

            {sharedViewers.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {sharedViewers.map((viewer) => (
                  <li
                    key={viewer.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/10 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base">{viewer.email}</p>
                      <p className="text-sm text-foreground/50">
                        {[
                          viewer.canViewMealPlan && "Meal Plan",
                          viewer.canViewRecipes && "Recipes",
                        ]
                          .filter(Boolean)
                          .join(", ") || "No access"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm ${
                        viewer.status === "Active" ? "text-secondary" : "text-foreground/50"
                      }`}
                    >
                      {viewer.status}
                    </span>
                    <form action={removeSharedViewer.bind(null, viewer.id)}>
                      <button
                        type="submit"
                        className="shrink-0 text-sm text-red-600 underline hover:text-red-700 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4">
              <AddViewerForm />
            </div>
          </div>
        )}
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
