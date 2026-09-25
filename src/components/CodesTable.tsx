"use client";

import { useState } from "react";
import type { CodeType, SuggestedCode } from "@/lib/types";
import EmptyState from "./EmptyState";
import OptumLookup from "./OptumLookup";

interface CodesTableProps {
  codes: SuggestedCode[];
  isLoading: boolean;
  onAddManual: (
    code: string,
    description: string,
    type: CodeType,
    modifier?: string,
    units?: number
  ) => void;
  onAddFromOptum: (code: string, description: string, type: CodeType) => void;
  onExport: () => void;
}

// Modifier/units only apply to CPT/HCPCS/E-M codes, never ICD-10 — see
// AGENTS.md "Domain model quirks worth knowing".
const hasModifierOrUnits = (codes: SuggestedCode[]) =>
  codes.some((code) => code.modifier !== undefined || code.units !== undefined);

export default function CodesTable({
  codes,
  isLoading,
  onAddManual,
  onAddFromOptum,
  onExport,
}: CodesTableProps) {
  const showModifierUnits = hasModifierOrUnits(codes);

  if (isLoading) {
    return <CodesTableSkeleton />;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Suggested Codes
        </h2>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Export Summary
        </button>
      </div>

      <div className="hidden overflow-x-auto sm:block">
        {codes.length === 0 ? (
          <EmptyState
            title="No codes yet"
            description="Add or look up a code below, or get suggestions from the button above."
          />
        ) : (
          <table className="w-full min-w-[560px] table-auto border-collapse text-sm">
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
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <CodeRow
                  key={code.id}
                  code={code}
                  showModifierUnits={showModifierUnits}
                />
              ))}
            </tbody>
          </table>
        )}
        <AddCodeRow onAdd={onAddManual} variant="row" />
        <OptumLookup onAdd={onAddFromOptum} variant="row" />
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {codes.length === 0 ? (
          <EmptyState
            title="No codes yet"
            description="Add or look up a code below, or get suggestions from the button above."
          />
        ) : (
          codes.map((code) => <CodeCard key={code.id} code={code} />)
        )}
        <AddCodeRow onAdd={onAddManual} variant="card" />
        <OptumLookup onAdd={onAddFromOptum} variant="card" />
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

function CodeRow({
  code,
  showModifierUnits,
}: {
  code: SuggestedCode;
  showModifierUnits: boolean;
}) {
  return (
    <tr className="border-b border-slate-100 align-top last:border-b-0">
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
          <td className="py-2.5 pr-3 text-slate-600">{code.units ?? "—"}</td>
        </>
      )}
      <td className="py-2.5 pr-3">
        <SourceBadge source={code.source} />
      </td>
    </tr>
  );
}

function CodeCard({ code }: { code: SuggestedCode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="font-mono text-sm font-semibold text-slate-800">
        {code.code}
      </p>
      <p className="text-sm text-slate-600">{code.description}</p>
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
