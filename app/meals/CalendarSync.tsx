"use client";

import { useEffect, useRef, useState } from "react";
import type { ExtrasStatus } from "@/lib/google";
import { syncCalendar } from "./syncActions";

type View =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "done"; changes: string[]; failed: number }
  | { kind: "expired" }
  | { kind: "error"; message: string };

// Each pass is capped server-side, so a big backlog takes a few passes.
const MAX_PASSES = 5;

async function runSync(setView: (view: View) => void) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const totals = { created: 0, fixed: 0, removed: 0, failed: 0 };

  try {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const result = await syncCalendar(timeZone);
      if (result.status === "expired") return setView({ kind: "expired" });
      if (result.status === "not-connected") return setView({ kind: "idle" });
      if (result.status === "error") return setView({ kind: "error", message: result.message });

      totals.created += result.created;
      totals.fixed += result.fixed;
      totals.removed += result.removed;
      totals.failed += result.failed;
      if (!result.more) break;
    }
  } catch {
    return setView({ kind: "error", message: "Couldn't reach the server." });
  }

  const changes = [
    totals.created > 0 && `${totals.created} added`,
    totals.fixed > 0 && `${totals.fixed} fixed`,
    totals.removed > 0 && `${totals.removed} removed`,
  ].filter((c): c is string => Boolean(c));
  setView({ kind: "done", changes, failed: totals.failed });
}

// Shows whether the Google calendar connection is actually working and, when
// it is, quietly brings the calendar in line with the meal plan on load.
export function CalendarSync({
  initialStatus,
  reconnectAction,
  variant,
}: {
  initialStatus: ExtrasStatus;
  reconnectAction: () => Promise<void>;
  variant: "home" | "meals";
}) {
  const [view, setView] = useState<View>(
    initialStatus === "connected"
      ? { kind: "syncing" }
      : initialStatus === "expired"
        ? { kind: "expired" }
        : { kind: "idle" },
  );
  const started = useRef(false);

  useEffect(() => {
    if (initialStatus !== "connected" || started.current) return;
    started.current = true;
    void runSync(setView);
  }, [initialStatus]);

  function syncNow() {
    setView({ kind: "syncing" });
    void runSync(setView);
  }

  if (view.kind === "expired") {
    return (
      <div className="rounded-lg border border-primary bg-primary/10 p-4">
        <p className="text-base font-medium">Google connection expired</p>
        <p className="mt-1 text-base text-foreground/70">
          Meals you plan aren&apos;t reaching your calendar, and Gmail import is off. Reconnect to
          fix it — ForkCast will then bring the calendar back in line with your meal plan
          automatically.
        </p>
        <form action={reconnectAction} className="mt-3">
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-2 text-base font-medium text-white hover:opacity-90"
          >
            Reconnect Google
          </button>
        </form>
      </div>
    );
  }

  if (view.kind === "idle") {
    if (variant !== "home") return null;
    return (
      <form action={reconnectAction}>
        <button
          type="submit"
          className="rounded-full border border-secondary px-5 py-2 text-sm font-medium text-secondary hover:bg-secondary/10"
        >
          Connect Google extras (calendar sync + Gmail import)
        </button>
      </form>
    );
  }

  if (view.kind === "syncing") {
    return <p className="text-sm text-foreground/60">Checking your calendar against the meal plan…</p>;
  }

  if (view.kind === "error") {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t check the calendar ({view.message}).{" "}
        <button type="button" onClick={syncNow} className="underline">
          Try again
        </button>
      </p>
    );
  }

  return (
    <p className="text-sm text-secondary">
      {view.changes.length > 0
        ? `Calendar updated to match your meal plan — ${view.changes.join(", ")}.`
        : "Google connected — your calendar matches your meal plan."}
      {view.failed > 0 && (
        <span className="text-red-600 dark:text-red-400">
          {" "}
          {view.failed} couldn&apos;t be synced.
        </span>
      )}{" "}
      <button type="button" onClick={syncNow} className="text-foreground/60 underline">
        Sync now
      </button>
    </p>
  );
}
