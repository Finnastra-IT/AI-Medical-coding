import { NextResponse } from "next/server";
import { updateUserRequestSchema } from "@/lib/schemas";
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

// Admin-only, see api/admin/users/route.ts for the shared "every handler
// checks requireAdminUser first" convention.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  // An admin deactivating/demoting their own only account would lock
  // everyone out of the admin panel — block it rather than letting that
  // happen by accident. They can still reset their own password this way.
  if (
    id === admin.id &&
    (parsed.data.isActive === false || parsed.data.role === "user")
  ) {
    return NextResponse.json(
      { error: "You can't deactivate or demote your own account" },
      { status: 400 }
    );
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (parsed.data.role !== undefined) {
    sets.push(`role = $${paramIndex++}`);
    values.push(parsed.data.role);
  }
  if (parsed.data.isActive !== undefined) {
    sets.push(`is_active = $${paramIndex++}`);
    values.push(parsed.data.isActive);
  }
  if (parsed.data.password !== undefined) {
    sets.push(`password_hash = $${paramIndex++}`);
    values.push(await hashPassword(parsed.data.password));
  }
  sets.push(`updated_at = now()`);
  values.push(id);

  const result = await query<UserRow>(
    `update users set ${sets.join(", ")} where id = $${paramIndex}
     returning id, username, role, is_active, created_at`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: toAppUser(result.rows[0]) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "You can't delete your own account" },
      { status: 400 }
    );
  }

  const result = await query("delete from users where id = $1", [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
