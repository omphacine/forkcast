import "server-only";
import { neon } from "@neondatabase/serverless";

// Owner-only: writes into Stride's own shopping_items table directly, so the
// owner has exactly one shopping list instead of two. Stride is single-tenant
// (no user_id column) — every query here matches that schema, unscoped.
const strideSql = neon(process.env.STRIDE_POSTGRES_URL!);

export default strideSql;
