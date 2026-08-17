"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function EnsureTimeZone() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tz", tz);
    router.replace(`/meals?${params.toString()}`);
  }, [router, searchParams]);

  return <p className="text-sm text-foreground/60">Loading Meal Plan...</p>;
}
