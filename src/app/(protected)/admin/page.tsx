import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import Header from "@/components/Header";
import AdminUsersPanel from "@/components/AdminUsersPanel";

// Second, independent admin check on top of `(protected)/layout.tsx` — that
// layout only confirms the visitor is logged in at all; this confirms they're
// specifically an admin, redirecting a regular user back to the main app
// rather than letting them see (or worse, hit the admin API routes behind)
// this page. See AGENTS.md "Authentication & admin user management".
//
// No extra `UserProvider` needed here — `AdminUsersPanel`'s `useCurrentUser()`
// is already satisfied by the one `(protected)/layout.tsx` provides; `Header`
// takes `user` as a plain prop, not context, so it just uses `admin` directly.
export default async function AdminPage() {
  const admin = await requireAdminUser();
  if (!admin) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header user={admin} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <AdminUsersPanel />
      </main>
    </div>
  );
}
