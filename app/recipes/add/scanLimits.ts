// Shared by the scan form (to stop at the limit) and the server action (to
// enforce it) — lives outside actions.ts because a "use server" file can only
// export async functions.
export const MAX_SCAN_PHOTOS = 6;
