// One-time (and safe-to-rerun) setup: creates the `users`/`sessions` tables
// if they don't exist, and seeds a single initial admin account if no admin
// exists yet. Run with: `pnpm run db:setup-auth`.
//
// Deliberately a plain Node script, not a Next.js route — it needs to run
// once, outside any request, before the app has any way to create its own
// first user (only admins can create users through the admin UI). See
// AGENTS.md "Authentication & admin user management" for the full picture.
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!fs.existsSync(path)) return {};
  const text = fs.readFileSync(path, "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

const env = { ...loadEnvLocal(), ...process.env };

if (!env.DATABASE_CONNECTION_STRING) {
  console.error("DATABASE_CONNECTION_STRING is not set in .env.local");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: env.DATABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);`
  );

  console.log("Tables ready: users, sessions");

  const { rows } = await pool.query(
    "SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"
  );
  if (rows.length > 0) {
    console.log("An admin account already exists — skipping seed.");
    return;
  }

  const username = "admin";
  const password = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (id, username, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', true)`,
    [crypto.randomUUID(), username, passwordHash]
  );

  console.log("\nInitial admin account created:");
  console.log(`  username: ${username}`);
  console.log(`  password: ${password}`);
  console.log(
    "\nThis password is shown only once and is not stored anywhere in the repo — log in and change it (or create your own admin and deactivate this one) right away."
  );
}

main()
  .catch((err) => {
    console.error("Setup failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
