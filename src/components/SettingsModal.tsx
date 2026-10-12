"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { changePassword, getErrorMessage } from "@/lib/api";
import type { AppUser } from "@/lib/types";
import Modal from "./Modal";

type View = "menu" | "change-password";

// Self-contained: owns its own open/close state and view, renders its own
// gear-icon trigger — same pattern OptumLookup.tsx uses for its "Look up a
// code" button + Modal. Dropped into Header.tsx for every logged-in user
// regardless of role. The gear icon opens a Settings destination (account
// info + a list of actions), not a single action directly — see AGENTS.md
// "Authentication & admin user management" for why Change Password lives
// inside it as the first item rather than being the gear's whole job.
export default function SettingsModal({ user }: { user: AppUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("menu");

  const close = () => {
    setIsOpen(false);
    setView("menu"); // reset for next open, regardless of where this close came from
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Settings"
        title="Settings"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <GearIcon className="h-4 w-4" />
      </button>
      {isOpen && (
        <Modal
          title={view === "menu" ? "Settings" : "Change Password"}
          onClose={close}
        >
          {view === "menu" ? (
            <SettingsMenu
              user={user}
              onChangePassword={() => setView("change-password")}
            />
          ) : (
            <ChangePasswordForm
              onBack={() => setView("menu")}
              onDone={close}
            />
          )}
        </Modal>
      )}
    </>
  );
}

function SettingsMenu({
  user,
  onChangePassword,
}: {
  user: AppUser;
  onChangePassword: () => void;
}) {
  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <InfoRow label="Username" value={user.username} />
        <InfoRow label="Role" value={user.role === "admin" ? "Admin" : "User"} />
        <InfoRow label="Member since" value={memberSince} />
      </div>

      <button
        type="button"
        onClick={onChangePassword}
        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        Change Password
        <span className="text-slate-400" aria-hidden="true">
          &rarr;
        </span>
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ChangePasswordForm({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    passwordsMatch &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update your password."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-xs font-medium text-slate-500 transition-colors hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
      >
        <span aria-hidden="true">&larr;</span> Back to Settings
      </button>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Current password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoFocus
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">
          New password (min. 8 characters)
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Confirm new password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <span className="text-xs text-red-600">
            Passwords don&apos;t match.
          </span>
        )}
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isSubmitting ? "Updating…" : "Update Password"}
      </button>
    </div>
  );
}

function GearIcon({ className }: { className?: string }) {
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
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.23.54.76.9 1.35.91H21a2 2 0 1 1 0 4h-.09c-.59.01-1.12.37-1.35.91Z" />
    </svg>
  );
}
