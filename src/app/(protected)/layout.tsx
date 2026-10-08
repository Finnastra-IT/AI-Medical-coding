import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { UserProvider } from "@/lib/userContext";

// This is the REAL security boundary for every page under this route group
// (middleware.ts only checks whether a session cookie exists at all, not
// whether it's valid — see that file's comment). Runs server-side on every
// request, so an admin deactivating a user takes effect on that user's very
// next navigation, not just at their next login.
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return <UserProvider user={user}>{children}</UserProvider>;
}
