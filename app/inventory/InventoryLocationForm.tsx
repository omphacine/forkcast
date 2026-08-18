"use client";

import { useRef } from "react";
import { LocationSelect } from "./LocationSelect";

export function InventoryLocationForm({
  action,
  defaultValue,
  locations,
}: {
  action: (formData: FormData) => void;
  defaultValue: string | null;
  locations: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <LocationSelect
        locations={locations}
        defaultValue={defaultValue}
        onCommit={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
