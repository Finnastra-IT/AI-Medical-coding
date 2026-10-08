// Server-only — imports `next/headers`, which throws if used from a "use
// client" component/file. Never import this from client code.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "./db";
import type { AppUser, UserRole } from "./types";

const SESSION_COOKIE = "medicode_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Sessions are looked up by a SHA-256 hash of the token, never the raw
// token itself — the same reasoning as password hashing: a leaked database
// row shouldn't by itself be a usable session.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
}

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

// Includes `password_hash` — for internal use only (verifying a login
// attempt). Never return this row, or its hash, to the client.
export async function findUserByUsername(
  username: string
): Promise<UserRow | null> {
  const result = await query<UserRow>(
    "select * from users where username = $1",
    [username]
  );
  return result.rows[0] ?? null;
}

// Creates a session row and sets the httpOnly cookie on the current
// response. Route Handler / Server Action context only (`cookies()` can't
// set cookies from a plain Server Component render).
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)",
    [hashToken(token), userId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token_hash = $1", [
      hashToken(token),
    ]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

// Validates the current request's session cookie against the database —
// checks expiry AND that the user hasn't been deactivated since the session
// was issued, so an admin disabling a user takes effect on that user's very
// next request, not just at their next login. Returns null if there's no
// session cookie, it's expired/unknown, or the user is inactive; callers
// decide how to respond (redirect to /login for pages, 401 for API routes).
export async function getSessionUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<UserRow>(
    `select u.id, u.username, u.password_hash, u.role, u.is_active, u.created_at
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.is_active = true`,
    [hashToken(token)]
  );
  const row = result.rows[0];
  return row ? toAppUser(row) : null;
}

// Convenience wrapper for admin-only routes/pages.
export async function requireAdminUser(): Promise<AppUser | null> {
  const user = await getSessionUser();
  return user && user.role === "admin" ? user : null;
}
