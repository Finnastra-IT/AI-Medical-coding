import { NextResponse } from "next/server";
import { loginRequestSchema } from "@/lib/schemas";
import { createSession, findUserByUsername, verifyPassword } from "@/lib/auth";

// Live, always. Validates username/password against the `users` table
// (plain table auth, not Supabase Auth — see AGENTS.md "Authentication &
// admin user management"), and on success sets the session cookie.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;
  const user = await findUserByUsername(username);

  // Deliberately the same generic error whether the username doesn't exist,
  // the password is wrong, or the account is deactivated — never reveal
  // which, so a login attempt can't be used to enumerate valid usernames.
  const invalidCredentials = () =>
    NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );

  if (!user || !user.is_active) {
    return invalidCredentials();
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return invalidCredentials();
  }

  await createSession(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at.toISOString(),
    },
  });
}
