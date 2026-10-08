"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  createUser,
  deleteUser,
  getErrorMessage,
  listUsers,
  updateUser,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/userContext";
import type { AppUser, UserRole } from "@/lib/types";
import Modal from "./Modal";

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminUsersPanel() {
  const currentUser = useCurrentUser();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<AppUser | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((loaded) => {
        if (!cancelled) setUsers(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(getErrorMessage(err, "Could not load users."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleActive(user: AppUser) {
    try {
      const updated = await updateUser(user.id, { isActive: !user.isActive });
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === updated.id ? updated : u)) : prev
      );
      toast.success(
        `${updated.username} is now ${updated.isActive ? "active" : "inactive"}`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update that user."));
    }
  }

  async function handleRoleChange(user: AppUser, role: UserRole) {
    try {
      const updated = await updateUser(user.id, { role });
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === updated.id ? updated : u)) : prev
      );
      toast.success(`${updated.username} is now ${role === "admin" ? "an admin" : "a regular user"}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update that user."));
    }
  }

  async function handleDelete(user: AppUser) {
    if (
      !window.confirm(
        `Delete ${user.username}? This can't be undone — they'll lose access immediately.`
      )
    ) {
      return;
    }
    try {
      await deleteUser(user.id);
      setUsers((prev) => (prev ? prev.filter((u) => u.id !== user.id) : prev));
      toast.success(`${user.username} was deleted`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete that user."));
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          User Management
        </h2>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          + Create User
        </button>
      </div>

      {users === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-10 w-full animate-pulse rounded bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] table-auto border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Username</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isSelf={user.id === currentUser.id}
                    onToggleActive={() => handleToggleActive(user)}
                    onRoleChange={(role) => handleRoleChange(user, role)}
                    onResetPassword={() => setResetPasswordUser(user)}
                    onDelete={() => handleDelete(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isSelf={user.id === currentUser.id}
                onToggleActive={() => handleToggleActive(user)}
                onRoleChange={(role) => handleRoleChange(user, role)}
                onResetPassword={() => setResetPasswordUser(user)}
                onDelete={() => handleDelete(user)}
              />
            ))}
          </div>

          {users.length === 0 && (
            <p className="text-xs text-slate-400">No users yet.</p>
          )}
        </>
      )}

      {isCreateOpen && (
        <CreateUserModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(user) => {
            setUsers((prev) => (prev ? [...prev, user] : [user]));
            setIsCreateOpen(false);
          }}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onReset={() => setResetPasswordUser(null)}
        />
      )}
    </section>
  );
}

function UserRow({
  user,
  isSelf,
  onToggleActive,
  onRoleChange,
  onResetPassword,
  onDelete,
}: {
  user: AppUser;
  isSelf: boolean;
  onToggleActive: () => void;
  onRoleChange: (role: UserRole) => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-slate-100 align-top last:border-b-0">
      <td className="py-2.5 pr-3 font-medium text-slate-800">
        {user.username}
        {isSelf && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
      </td>
      <td className="py-2.5 pr-3">
        <select
          value={user.role}
          onChange={(event) => onRoleChange(event.target.value as UserRole)}
          disabled={isSelf}
          aria-label={`Role for ${user.username}`}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="py-2.5 pr-3">
        <StatusBadge isActive={user.isActive} />
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-500">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={isSelf}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={onResetPassword}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Reset password
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isSelf}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function UserCard({
  user,
  isSelf,
  onToggleActive,
  onRoleChange,
  onResetPassword,
  onDelete,
}: {
  user: AppUser;
  isSelf: boolean;
  onToggleActive: () => void;
  onRoleChange: (role: UserRole) => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">
          {user.username}
          {isSelf && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
        </p>
        <StatusBadge isActive={user.isActive} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={user.role}
          onChange={(event) => onRoleChange(event.target.value as UserRole)}
          disabled={isSelf}
          aria-label={`Role for ${user.username}`}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <span className="text-xs text-slate-400">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleActive}
          disabled={isSelf}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onResetPassword}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Reset password
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isSelf}
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: AppUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = username.trim().length >= 3 && password.length >= 8;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await createUser({
        username: username.trim(),
        password,
        role,
      });
      toast.success(`${user.username} created`);
      onCreated(user);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create that user."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Create User" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">
            Username (min. 3 characters)
          </span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoFocus
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">
            Password (min. 8 characters)
          </span>
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
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
          disabled={!canSubmit || isSubmitting}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSubmitting ? "Creating…" : "Create User"}
        </button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onReset,
}: {
  user: AppUser;
  onClose: () => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length >= 8;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateUser(user.id, { password });
      toast.success(`Password reset for ${user.username}`);
      onReset();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset that password."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.username}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">
            New password (min. 8 characters)
          </span>
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
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
          disabled={!canSubmit || isSubmitting}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSubmitting ? "Resetting…" : "Reset Password"}
        </button>
      </div>
    </Modal>
  );
}
