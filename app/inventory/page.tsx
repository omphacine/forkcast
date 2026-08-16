import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { getZonedParts, getExtrasAccessToken } from "@/lib/google";
import { getInventoryItems, type InventoryItem } from "./data";
import {
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItemCategory,
  updateInventoryItemExpiration,
  updateInventoryItemLocation,
  updateInventoryItemName,
  updateInventoryItemQuantity,
} from "./actions";
import { InventoryItemNameForm } from "./InventoryItemNameForm";
import { InventoryFieldForm } from "./InventoryFieldForm";
import { InventoryExpirationForm } from "./InventoryExpirationForm";
import { ScanReceiptForm } from "./ScanReceiptForm";
import { EnsureTimeZone } from "./EnsureTimeZone";

const UNCATEGORIZED = "Uncategorized";

function groupByCategory(items: InventoryItem[]) {
  const groups = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const key = item.category ?? UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries());
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function expirationBadge(expirationDate: string | null, today: string) {
  if (!expirationDate) return null;
  if (expirationDate < today) {
    return <span className="text-sm font-medium text-red-600 dark:text-red-400">Expired</span>;
  }
  if (expirationDate === today) {
    return <span className="text-sm font-medium text-primary">Expires today</span>;
  }
  return (
    <span className="text-sm font-medium text-foreground/50">
      Expires {formatDate(expirationDate)}
    </span>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tz?: string }>;
}) {
  const session = await auth();

  if (!session?.appUserId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-foreground/60">
          Sign in with Google to see your food inventory.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/inventory" });
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

  const params = await searchParams;

  if (!params.tz) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EnsureTimeZone />
      </div>
    );
  }

  const today = getZonedParts(new Date(), params.tz).dateStr;
  const items = await getInventoryItems(session.appUserId);
  const groups = groupByCategory(items);
  const hasGmailImport = Boolean(await getExtrasAccessToken());

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

      <div>
        <h1 className="font-heading text-4xl font-semibold">Food Inventory</h1>
        <p className="mt-1 text-base text-foreground/60">
          What&apos;s on hand, and where — so it gets used before it gets forgotten.
        </p>

        <div className="mt-4">
          <ScanReceiptForm hasGmailImport={hasGmailImport} />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {groups.map(([category, categoryItems]) => (
            <details key={category} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-heading text-xl font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="text-foreground/40 transition-transform group-open:rotate-90">
                  &rsaquo;
                </span>
                {category}
                <span className="text-base font-normal text-foreground/40">
                  ({categoryItems.length})
                </span>
              </summary>
              <ul className="mt-2 flex flex-col gap-3">
                {categoryItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3"
                  >
                    <div className="min-w-[160px] flex-1">
                      <InventoryItemNameForm
                        action={updateInventoryItemName.bind(null, item.id)}
                        defaultValue={item.name}
                      />
                      {expirationBadge(item.expirationDate, today)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <InventoryFieldForm
                        action={updateInventoryItemCategory.bind(null, item.id)}
                        defaultValue={item.category}
                        fieldName="category"
                        placeholder="Category"
                      />
                      <InventoryFieldForm
                        action={updateInventoryItemQuantity.bind(null, item.id)}
                        defaultValue={item.quantity}
                        fieldName="quantity"
                        placeholder="Quantity"
                      />
                      <InventoryFieldForm
                        action={updateInventoryItemLocation.bind(null, item.id)}
                        defaultValue={item.location}
                        fieldName="location"
                        placeholder="Location"
                      />
                      <InventoryExpirationForm
                        action={updateInventoryItemExpiration.bind(null, item.id)}
                        defaultValue={item.expirationDate}
                      />
                      <form action={deleteInventoryItem.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="text-base text-red-600 underline hover:text-red-700 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {items.length === 0 && (
            <p className="text-base text-foreground/60">Nothing in the inventory yet.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold">Add item</h2>
        <form action={createInventoryItem} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            placeholder="Item name"
            required
            className="min-w-0 flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="category"
            placeholder="Category (optional)"
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="quantity"
            placeholder="Quantity (optional)"
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <input
            name="location"
            placeholder="Location (optional)"
            className="rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg"
          />
          <label className="flex flex-col text-sm text-foreground/60">
            Expiration date (optional)
            <input
              name="expirationDate"
              type="date"
              className="mt-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-lg text-foreground"
            />
          </label>
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
