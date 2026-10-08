import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createUserRequestSchema } from "@/lib/schemas";
import { hashPassword, requireAdminUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { AppUser } from "@/lib/types";

interface UserRow {
  id: string;
  username: string;
  role: "admin" | "user";
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

// Live, always. Admin-only — every handler here starts with the same
// `requireAdminUser` check (see AGENTS.md "Authentication & admin user
// management"); a non-admin (or logged-out) request gets a 403/401 before
// touching the database.

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await query<UserRow>(
    "select id, username, role, is_active, created_at from users order by created_at asc"
  );
  return NextResponse.json({ users: result.rows.map(toAppUser) });
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { username, password, role } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const result = await query<UserRow>(
      `insert into users (id, username, password_hash, role, is_active)
       values ($1, $2, $3, $4, true)
       returning id, username, role, is_active, created_at`,
      [crypto.randomUUID(), username, passwordHash, role]
    );
    return NextResponse.json({ user: toAppUser(result.rows[0]) }, { status: 201 });
  } catch (error) {
    // Postgres unique_violation on the `username` column.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "That username is already taken" },
        { status: 409 }
      );
    }
    throw error;
  }
}
