"use client";

export function ExpandCollapseControls({ targetId }: { targetId: string }) {
  function setAll(open: boolean) {
    const container = document.getElementById(targetId);
    container?.querySelectorAll("details").forEach((el) => {
      (el as HTMLDetailsElement).open = open;
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setAll(true)}
        className="rounded-full border border-foreground/10 px-3 py-1 text-sm hover:bg-foreground/5"
      >
        Expand all
      </button>
      <button
        type="button"
        onClick={() => setAll(false)}
        className="rounded-full border border-foreground/10 px-3 py-1 text-sm hover:bg-foreground/5"
      >
        Collapse all
      </button>
    </div>
  );
}
