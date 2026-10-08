"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppUser } from "./types";

// Lets a client page under `(protected)/` read the already-resolved session
// user without an extra client-side fetch — `(protected)/layout.tsx` (a
// Server Component) resolves it once via `getSessionUser()` and provides it
// here. Kept separate from `Header` itself so `page.tsx` can still fully
// control when/how Header renders (it needs to pass its own client-side
// `currentStep`, which a layout has no way to receive from the page below
// it) — see AGENTS.md "Authentication & admin user management".
const UserContext = createContext<AppUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): AppUser {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error(
      "useCurrentUser() was called outside a UserProvider — it must be used by a page under the (protected) route group."
    );
  }
  return user;
}
