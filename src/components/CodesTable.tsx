"use client";

import { useState } from "react";
import type { CodeType, SuggestedCode } from "@/lib/types";
import EmptyState from "./EmptyState";

interface CodesTableProps {
  codes: SuggestedCode[];
  isLoading: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string, code: string, description: string) => void;
  onAddManual: (
    code: string,
    description: string,
    type: CodeType,
    modifier?: string,
    units?: number
  ) => void;
}

// Modifier/units only apply to CPT/HCPCS/E-M codes, never ICD-10 — see
// AGENTS.md "Domain model quirks worth knowing".
const hasModifierOrUnits = (codes: SuggestedCode[]) =>
  codes.some((code) => code.modifier !== undefined || code.units !== undefined);

const STATUS_STYLES: Record<SuggestedCode["status"], string> = {
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  modified: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function CodesTable({
  codes,
  isLoading,
  onAccept,
  onReject,
  onModify,
  onAddManual,
}: CodesTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const showModifierUnits = hasModifierOrUnits(codes);

  if (isLoading) {
    return <CodesTableSkeleton />;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        Suggested Codes
      </h2>

      <div className="hidden overflow-x-auto sm:block">
        {codes.length === 0 ? (
          <EmptyState
            title="No codes yet"
            description="Add a code manually below, or get suggestions from Optum above."
          />
        ) : (
          <table className="w-full min-w-[720px] table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                {showModifierUnits && (
                  <>
                    <th className="py-2 pr-3 font-medium">Modifier</th>
                    <th className="py-2 pr-3 font-medium">Units</th>
                  </>
                )}
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <CodeRow
                  key={code.id}
                  code={code}
                  showModifierUnits={showModifierUnits}
                  isEditing={editingId === code.id}
                  onStartEdit={() => setEditingId(code.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onAccept={() => onAccept(code.id)}
                  onReject={() => onReject(code.id)}
                  onSaveModify={(nextCode, nextDescription) => {
                    onModify(code.id, nextCode, nextDescription);
                    setEditingId(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
        <AddCodeRow onAdd={onAddManual} variant="row" />
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {codes.length === 0 ? (
          <EmptyState
            title="No codes yet"
            description="Add a code manually below, or get suggestions from Optum above."
          />
        ) : (
          codes.map((code) => (
            <CodeCard
              key={code.id}
              code={code}
              isEditing={editingId === code.id}
              onStartEdit={() => setEditingId(code.id)}
              onCancelEdit={() => setEditingId(null)}
              onAccept={() => onAccept(code.id)}
              onReject={() => onReject(code.id)}
              onSaveModify={(nextCode, nextDescription) => {
                onModify(code.id, nextCode, nextDescription);
                setEditingId(null);
              }}
            />
          ))
        )}
        <AddCodeRow onAdd={onAddManual} variant="card" />
      </div>
    </section>
  );
}

export function CodesTableSkeleton() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-10 w-full animate-pulse rounded bg-slate-100"
          />
        ))}
      </div>
    </section>
  );
}

const TYPE_STYLES: Record<CodeType, string> = {
  "ICD-10": "border-sky-200 bg-sky-50 text-sky-700",
  CPT: "border-violet-200 bg-violet-50 text-violet-700",
  HCPCS: "border-amber-200 bg-amber-50 text-amber-700",
  "E/M": "border-teal-200 bg-teal-50 text-teal-700",
};

function TypeBadge({ type }: { type: CodeType }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        TYPE_STYLES[type],
      ].join(" ")}
    >
      {type}
    </span>
  );
}

const SOURCE_STYLES: Record<SuggestedCode["source"], string> = {
  AI: "border-teal-200 bg-teal-50 text-teal-700",
  Optum: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Manual: "border-slate-200 bg-slate-100 text-slate-600",
};

function SourceBadge({ source }: { source: SuggestedCode["source"] }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        SOURCE_STYLES[source],
      ].join(" ")}
    >
      {source}
    </span>
  );
}

function StatusBadge({ status }: { status: SuggestedCode["status"] }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function RowActions({
  status,
  isEditing,
  onAccept,
  onReject,
  onStartEdit,
}: {
  status: SuggestedCode["status"];
  isEditing: boolean;
  onAccept: () => void;
  onReject: () => void;
  onStartEdit: () => void;
}) {
  if (isEditing) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onAccept}
        aria-label="Accept code"
        title="Accept"
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500",
          status === "accepted"
            ? "border-green-300 bg-green-100 text-green-700"
            : "border-slate-200 text-slate-500 hover:border-green-300 hover:bg-green-50 hover:text-green-700",
        ].join(" ")}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onReject}
        aria-label="Reject code"
        title="Reject"
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
          status === "rejected"
            ? "border-red-300 bg-red-100 text-red-700"
            : "border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
        ].join(" ")}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        aria-label="Modify code"
        title="Modify"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ModifyForm({
  initialCode,
  initialDescription,
  onSave,
  onCancel,
}: {
  initialCode: string;
  initialDescription: string;
  onSave: (code: string, description: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [description, setDescription] = useState(initialDescription);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        aria-label="Modified code"
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 sm:w-28"
      />
      <input
        type="text"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        aria-label="Modified description"
        className="w-full flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      />
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onSave(code.trim(), description.trim())}
          disabled={code.trim().length === 0 || description.trim().length === 0}
          className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface RowSharedProps {
  code: SuggestedCode;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onAccept: () => void;
  onReject: () => void;
  onSaveModify: (code: string, description: string) => void;
}

function CodeRow({
  code,
  showModifierUnits,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onAccept,
  onReject,
  onSaveModify,
}: RowSharedProps & { showModifierUnits: boolean }) {
  return (
    <tr className="border-b border-slate-100 align-top last:border-b-0">
      {isEditing ? (
        <td colSpan={showModifierUnits ? 8 : 6} className="py-2.5 pr-3">
          <ModifyForm
            initialCode={code.code}
            initialDescription={code.description}
            onSave={onSaveModify}
            onCancel={onCancelEdit}
          />
        </td>
      ) : (
        <>
          <td className="py-2.5 pr-3 font-mono text-sm font-medium text-slate-800">
            {code.code}
          </td>
          <td className="py-2.5 pr-3 text-slate-600">{code.description}</td>
          <td className="py-2.5 pr-3">
            <TypeBadge type={code.type} />
          </td>
          {showModifierUnits && (
            <>
              <td className="py-2.5 pr-3 font-mono text-sm text-slate-600">
                {code.modifier ?? "—"}
              </td>
              <td className="py-2.5 pr-3 text-slate-600">
                {code.units ?? "—"}
              </td>
            </>
          )}
          <td className="py-2.5 pr-3">
            <SourceBadge source={code.source} />
          </td>
          <td className="py-2.5 pr-3">
            <StatusBadge status={code.status} />
          </td>
          <td className="py-2.5 pr-3">
            <RowActions
              status={code.status}
              isEditing={isEditing}
              onAccept={onAccept}
              onReject={onReject}
              onStartEdit={onStartEdit}
            />
          </td>
        </>
      )}
    </tr>
  );
}

function CodeCard({
  code,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onAccept,
  onReject,
  onSaveModify,
}: RowSharedProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      {isEditing ? (
        <ModifyForm
          initialCode={code.code}
          initialDescription={code.description}
          onSave={onSaveModify}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold text-slate-800">
                {code.code}
              </p>
              <p className="text-sm text-slate-600">{code.description}</p>
            </div>
            <StatusBadge status={code.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={code.type} />
            <SourceBadge source={code.source} />
            {code.modifier !== undefined && (
              <span className="text-xs text-slate-500">
                Mod: <span className="font-mono">{code.modifier}</span>
              </span>
            )}
            {code.units !== undefined && (
              <span className="text-xs text-slate-500">
                Units: <span className="font-mono">{code.units}</span>
              </span>
            )}
          </div>
          <div className="mt-3">
            <RowActions
              status={code.status}
              isEditing={isEditing}
              onAccept={onAccept}
              onReject={onReject}
              onStartEdit={onStartEdit}
            />
          </div>
        </>
      )}
    </div>
  );
}

function AddCodeRow({
  onAdd,
  variant,
}: {
  onAdd: (
    code: string,
    description: string,
    type: CodeType,
    modifier?: string,
    units?: number
  ) => void;
  variant: "row" | "card";
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CodeType>("ICD-10");
  const [modifier, setModifier] = useState("");
  const [units, setUnits] = useState("");

  const reset = () => {
    setIsAdding(false);
    setCode("");
    setDescription("");
    setType("ICD-10");
    setModifier("");
    setUnits("");
  };

  const canSubmit = code.trim().length > 0 && description.trim().length > 0;
  // Modifier/units only make sense for billable service codes, not diagnoses.
  const showServiceFields = type !== "ICD-10";

  const submit = () => {
    if (!canSubmit) return;
    const parsedUnits = Number(units);
    onAdd(
      code.trim(),
      description.trim(),
      type,
      showServiceFields && modifier.trim() ? modifier.trim() : undefined,
      showServiceFields && units.trim() && Number.isFinite(parsedUnits)
        ? parsedUnits
        : undefined
    );
    reset();
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className={
          variant === "row"
            ? "mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            : "flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        }
      >
        <PlusIcon className="h-4 w-4" />
        Add missed code
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
      <select
        value={type}
        onChange={(event) => setType(event.target.value as CodeType)}
        aria-label="Code type"
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        <option value="ICD-10">ICD-10</option>
        <option value="CPT">CPT</option>
        <option value="HCPCS">HCPCS</option>
        <option value="E/M">E/M</option>
      </select>
      <input
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Code"
        aria-label="New code"
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 sm:w-28"
      />
      <input
        type="text"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
        aria-label="New code description"
        className="w-full flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      />
      {showServiceFields && (
        <>
          <input
            type="text"
            value={modifier}
            onChange={(event) => setModifier(event.target.value)}
            placeholder="Modifier"
            aria-label="New code modifier"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 sm:w-20"
          />
          <input
            type="number"
            min={1}
            value={units}
            onChange={(event) => setUnits(event.target.value)}
            placeholder="Units"
            aria-label="New code units"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 sm:w-20"
          />
        </>
      )}
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Add
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
