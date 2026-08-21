"use client";

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="rounded-full bg-foreground px-5 py-3 text-base font-medium text-background shadow-lg">
        {message}
      </div>
    </div>
  );
}
