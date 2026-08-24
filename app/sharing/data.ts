import sql from "@/lib/db";

export type SharedViewer = {
  id: number;
  email: string;
  status: "Pending" | "Active";
};

export async function getSharedViewers(): Promise<SharedViewer[]> {
  const rows = await sql`
    SELECT id, email, user_id AS "userId" FROM shared_viewers ORDER BY created_at ASC
  `;
  return (rows as unknown as { id: number; email: string; userId: number | null }[]).map(
    (row) => ({
      id: row.id,
      email: row.email,
      status: row.userId === null ? "Pending" : "Active",
    }),
  );
}
