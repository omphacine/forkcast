import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { getShoppingItems, type ShoppingItem } from "./data";
import {
  createShoppingItem,
  deleteShoppingItem,
  toggleShoppingItemComplete,
  updateShoppingItemName,
  updateShoppingItemStore,
} from "./actions";
import { ShoppingItemStoreForm } from "./ShoppingItemStoreForm";
import { ShoppingItemNameForm } from "./ShoppingItemNameForm";

const UNCATEGORIZED = "Uncategorized";

function groupByStore(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const key = item.store ?? UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries());
}

export default async function ShoppingPage() {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">
          Sign in with Google to see your shopping list.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/shopping" });
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

  const items = await getShoppingItems();
  const groups = groupByStore(items);

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
        <h1 className="font-heading text-4xl font-semibold">Shopping List</h1>

        <div className="mt-4 flex flex-col gap-6">
          {groups.map(([store, storeItems]) => (
            <div key={store}>
              <h2 className="font-heading text-2xl font-semibold">{store}</h2>
              <ul className="mt-2 flex flex-col gap-3">
                {storeItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3"
                  >
                    <form action={toggleShoppingItemComplete.bind(null, item.id)}>
                      <button
                        type="submit"
                        aria-label="Mark item purchased"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
                        style={{ borderColor: "rgba(128,128,128,0.35)" }}
                      />
                    </form>

                    <div className="min-w-0 flex-1">
                      <ShoppingItemNameForm
                        action={updateShoppingItemName.bind(null, item.id)}
                        defaultValue={item.name}
                        strikethrough={false}
                      />
                      {item.source && (
                        <p className="text-sm text-foreground/50">From: {item.source}</p>
                      )}
                    </div>

                    <ShoppingItemStoreForm
                      action={updateShoppingItemStore.bind(null, item.id)}
                      defaultValue={item.store}
                    />

                    <form action={deleteShoppingItem.bind(null, item.id)}>
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
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-base text-foreground/60">Your shopping list is empty.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Add item</h2>
        <form action={createShoppingItem} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            placeholder="Item name"
            required
            className="flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="store"
            placeholder="Store (optional)"
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
