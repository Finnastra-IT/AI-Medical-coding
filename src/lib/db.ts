import { Pool, type QueryResultRow } from "pg";

// Server-only direct Postgres connection (the app's Supabase project, used
// here purely as a hosted Postgres database — NOT via Supabase's own Auth or
// client SDK). See AGENTS.md "Authentication & admin user management" for
// why: the app needed literal username/password accounts an admin creates
// and manages directly, which is simpler as a plain table than bolting onto
// Supabase Auth's email-centric model.
//
// `rejectUnauthorized: false` is required for Supabase's pooled connection
// string specifically (its certificate isn't in Node's default trust store)
// — this is Supabase's own documented connection pattern for direct `pg`
// clients, not a weakening we introduced.
const pool = new Pool({
  connectionString: process.env.DATABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}
