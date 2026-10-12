import { NextResponse } from "next/server";
import { changePasswordRequestSchema } from "@/lib/schemas";
import {
  findUserById,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { query } from "@/lib/db";

// Live, always. Self-service password change for the logged-in user's own
// account — distinct from PATCH /api/admin/users/[id], which is an admin
// resetting someone else's password without needing to know the old one.
// See AGENTS.md "Authentication & admin user management" for why both exist
// side by side rather than one replacing the other.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // getSessionUser() deliberately never returns password_hash — look the
  // row up again here, server-side only, to verify the current password.
  const row = await findUserById(user.id);
  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentMatches = await verifyPassword(
    currentPassword,
    row.password_hash
  );
  // Unlike the login route's deliberately generic error, this is fine to
  // state plainly — the request is already authenticated as this exact
  // user, so there's no username-enumeration risk here to protect against.
  if (!currentMatches) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  const newHash = await hashPassword(newPassword);
  await query("update users set password_hash = $1, updated_at = now() where id = $2", [
    newHash,
    user.id,
  ]);

  return NextResponse.json({ ok: true });
}
