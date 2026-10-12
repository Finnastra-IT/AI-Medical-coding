import Link from "next/link";
import type { ReactNode } from "react";
import StepIndicator from "./StepIndicator";
import LogoutButton from "./LogoutButton";
import SettingsModal from "./SettingsModal";
import type { AppUser } from "@/lib/types";

interface HeaderProps {
  /** Omitted on pages with no multi-step flow (e.g. the admin panel). */
  currentStep?: 1 | 2 | 3;
  /** Drives the amber badge on the Summary step pill — see StepIndicator. */
  clarificationsCount?: number;
  /**
   * Which page Header is rendered on — drives the active/inactive styling
   * on the Workspace/Admin nav below (admin-only). Each page passes this
   * explicitly (not derived from the URL) so Header stays a Server
   * Component. Omitted entirely only in contexts with no nav to style
   * (there are none today, but this keeps the type honest for future ones).
   */
  currentPage?: "app" | "admin";
  user: AppUser;
}

export default function Header({
  currentStep,
  clarificationsCount,
  currentPage,
  user,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
            <StethoscopeIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-slate-900">
              MediCode AI
            </h1>
            <p className="text-xs leading-tight text-slate-500">
              AI-Assisted Medical Coding{" "}
              <span className="text-slate-400">· Finnastra</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentStep && (
            <StepIndicator
              currentStep={currentStep}
              clarificationsCount={clarificationsCount}
            />
          )}

          {user.role === "admin" && (
            <nav
              className="flex items-center gap-1.5 border-slate-200 sm:border-l sm:pl-4"
              aria-label="Admin navigation"
            >
              <NavPill href="/" isActive={currentPage === "app"}>
                Workspace
              </NavPill>
              <NavPill href="/admin" isActive={currentPage === "admin"}>
                Admin
              </NavPill>
            </nav>
          )}

          <div className="flex items-center gap-3 border-slate-200 sm:border-l sm:pl-4">
            <span className="hidden text-xs text-slate-400 sm:inline">
              {user.username}
            </span>
            <SettingsModal user={user} />
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}

// Styled as an actual bordered pill at rest, not plain text that only
// signals "clickable" on hover — the previous version was easy to mistake
// for inert labels. `aria-current="page"` on the active one, matching the
// pattern StepIndicator already uses for its own current-step pill.
function NavPill({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={[
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
        isActive
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.8 2.3v6.4a4.7 4.7 0 0 0 9.4 0V2.3" />
      <path d="M9.5 15.5a6.7 6.7 0 0 0 6.7-6.7" />
      <path d="M16.2 15.5a3.8 3.8 0 1 0 0 7.5 3.8 3.8 0 0 0 0-7.5Z" />
      <path d="M4.8 4.6H3" />
      <path d="M14.2 4.6H16" />
    </svg>
  );
}
