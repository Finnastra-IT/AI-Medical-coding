"use client";

import { useState, type ReactNode } from "react";
import type {
  ClinicalSummary,
  CodeType,
  Diagnosis,
  OptumCodeType,
  Procedure,
} from "@/lib/types";
import EmptyState from "./EmptyState";
import OptumCodeSearch from "./OptumCodeSearch";

interface OptumCodeSelection {
  id: string;
  code: string;
  description: string;
  type: CodeType;
}

interface SummaryPanelProps {
  summary: ClinicalSummary | null;
  onChange: (summary: ClinicalSummary) => void;
  onGenerateCodes: () => void;
  isGeneratingCodes: boolean;
  onOptumCodeSelected: (selection: OptumCodeSelection) => void;
}

export default function SummaryPanel({
  summary,
  onChange,
  onGenerateCodes,
  isGeneratingCodes,
  onOptumCodeSelected,
}: SummaryPanelProps) {
  const [negationsOpen, setNegationsOpen] = useState(false);
  const [clarificationsOpen, setClarificationsOpen] = useState(true);

  return (
    <section className="flex flex-1 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Clinical Summary
        </h2>
      </div>

      {!summary && (
        <EmptyState
          title="Paste a SOAP note to begin"
          description="Analyze a note to see a structured clinical summary here."
        />
      )}

      {summary && (
        <div className="flex flex-1 flex-col gap-5">
          <FieldGroup label="Impression">
            <TextField
              value={summary.briefSummary}
              onChange={(value) => onChange({ ...summary, briefSummary: value })}
            />
          </FieldGroup>

          <FieldGroup label="Encounter">
            <TextField
              label="Type"
              value={summary.encounter.type}
              onChange={(value) =>
                onChange({
                  ...summary,
                  encounter: { ...summary.encounter, type: value },
                })
              }
            />
          </FieldGroup>

          <FieldGroup label="Diagnoses">
            <div className="flex flex-col gap-3">
              {summary.diagnoses.map((diagnosis, index) => (
                <DiagnosisEditor
                  key={diagnosis.id}
                  diagnosis={diagnosis}
                  onChange={(updated) => {
                    const diagnoses = [...summary.diagnoses];
                    diagnoses[index] = updated;
                    onChange({ ...summary, diagnoses });
                  }}
                  onOptumSelect={(code) => {
                    const diagnoses = [...summary.diagnoses];
                    diagnoses[index] = { ...diagnosis, icd10Hint: code };
                    onChange({ ...summary, diagnoses });
                    onOptumCodeSelected({
                      id: `ai-${diagnosis.id}`,
                      code,
                      description: diagnosis.condition,
                      type: "ICD-10",
                    });
                  }}
                />
              ))}
              {summary.diagnoses.length === 0 && (
                <p className="text-xs text-slate-400">No diagnoses found.</p>
              )}
            </div>
          </FieldGroup>

          <FieldGroup label="Procedures">
            <div className="flex flex-col gap-3">
              {summary.procedures.map((procedure, index) => (
                <ProcedureEditor
                  key={procedure.id}
                  procedure={procedure}
                  onChange={(updated) => {
                    const procedures = [...summary.procedures];
                    procedures[index] = updated;
                    onChange({ ...summary, procedures });
                  }}
                  onOptumSelect={(code, optumType) => {
                    const codeType = optumType === "hcpcs" ? "HCPCS" : "CPT";
                    const procedures = [...summary.procedures];
                    procedures[index] = { ...procedure, cptHint: code, codeType };
                    onChange({ ...summary, procedures });
                    onOptumCodeSelected({
                      id: `ai-${procedure.id}`,
                      code,
                      description: procedure.description,
                      type: codeType,
                    });
                  }}
                />
              ))}
              {summary.procedures.length === 0 && (
                <p className="text-xs text-slate-400">No procedures found.</p>
              )}
            </div>
          </FieldGroup>

          <FieldGroup
            label={`Negations (${summary.negations.length})`}
            action={
              <button
                type="button"
                onClick={() => setNegationsOpen((prev) => !prev)}
                aria-expanded={negationsOpen}
                aria-label={
                  negationsOpen ? "Collapse negations" : "Expand negations"
                }
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <PlusIcon
                  className={`h-3 w-3 transition-transform ${negationsOpen ? "rotate-45" : ""}`}
                />
              </button>
            }
          >
            {negationsOpen && (
              <div className="flex flex-col gap-2">
                {summary.negations.map((negation, index) => (
                  <TextField
                    key={negation.id}
                    value={negation.text}
                    onChange={(value) => {
                      const negations = [...summary.negations];
                      negations[index] = { ...negations[index], text: value };
                      onChange({ ...summary, negations });
                    }}
                  />
                ))}
                {summary.negations.length === 0 && (
                  <p className="text-xs text-slate-400">No negations found.</p>
                )}
              </div>
            )}
          </FieldGroup>

          <FieldGroup
            label={`Needs Clarification${summary.clarificationsNeeded.length > 0 ? ` (${summary.clarificationsNeeded.length})` : ""}`}
            action={
              summary.clarificationsNeeded.length > 0 && (
                <button
                  type="button"
                  onClick={() => setClarificationsOpen((prev) => !prev)}
                  aria-expanded={clarificationsOpen}
                  aria-label={
                    clarificationsOpen
                      ? "Collapse needs clarification"
                      : "Expand needs clarification"
                  }
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-200 text-amber-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <PlusIcon
                    className={`h-3 w-3 transition-transform ${clarificationsOpen ? "rotate-45" : ""}`}
                  />
                </button>
              )
            }
          >
            {summary.clarificationsNeeded.length === 0 ? (
              <p className="text-xs text-slate-400">
                No clarifications needed.
              </p>
            ) : (
              clarificationsOpen && (
                <ul className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-1.5">
                  {summary.clarificationsNeeded.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2.5 rounded-md bg-white/60 px-2.5 py-2"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-semibold text-amber-800">
                        {index + 1}
                      </span>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-amber-900">
                        {item}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            )}
          </FieldGroup>

          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={onGenerateCodes}
              disabled={isGeneratingCodes}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {isGeneratingCodes && (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth={4}
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
                  />
                </svg>
              )}
              {isGeneratingCodes ? "Checking Optum..." : "Get Codes via Optum (Optional)"}
            </button>
            <p className="text-xs text-slate-400">
              ICD-10/CPT codes above are already suggested by OpenAI. This
              optionally adds a second set of coded suggestions from Optum.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export function SummaryPanelSkeleton() {
  return (
    <section className="flex flex-1 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldGroup({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-slate-500">{label}</span>}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      />
    </label>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}


function DiagnosisEditor({
  diagnosis,
  onChange,
  onOptumSelect,
}: {
  diagnosis: Diagnosis;
  onChange: (diagnosis: Diagnosis) => void;
  onOptumSelect: (code: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex-1">
          <TextField
            label="Condition"
            value={diagnosis.condition}
            onChange={(value) => onChange({ ...diagnosis, condition: value })}
          />
        </div>
        <div className="w-full sm:w-32">
          <TextField
            label="ICD-10 Code"
            value={diagnosis.icd10Hint ?? ""}
            onChange={(value) => onChange({ ...diagnosis, icd10Hint: value })}
          />
          {!diagnosis.icd10Hint && (
            <OptumCodeSearch
              term={diagnosis.condition}
              codeTypes={["icd10cm"]}
              onSelect={(code) => onOptumSelect(code)}
            />
          )}
        </div>
      </div>
      {diagnosis.attributes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {diagnosis.attributes.map((attribute, index) => (
            <div key={index} className="flex items-center gap-1">
              <span className="rounded-l-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                {attribute.label}
              </span>
              <input
                type="text"
                value={attribute.value}
                onChange={(event) => {
                  const attributes = [...diagnosis.attributes];
                  attributes[index] = {
                    ...attributes[index],
                    value: event.target.value,
                  };
                  onChange({ ...diagnosis, attributes });
                }}
                aria-label={`${attribute.label} value`}
                className="w-28 rounded-r-md border border-l-0 border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CODE_TYPE_LABEL: Record<NonNullable<Procedure["codeType"]>, string> = {
  CPT: "CPT Code",
  HCPCS: "HCPCS Code",
  "E/M": "E/M Code",
};

function ProcedureEditor({
  procedure,
  onChange,
  onOptumSelect,
}: {
  procedure: Procedure;
  onChange: (procedure: Procedure) => void;
  onOptumSelect: (code: string, codeType: OptumCodeType) => void;
}) {
  const hasModifier = procedure.modifier !== undefined;
  const hasUnits = procedure.units !== undefined;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex-1">
          <TextField
            label="Description"
            value={procedure.description}
            onChange={(value) => onChange({ ...procedure, description: value })}
          />
        </div>
        <div className="w-full sm:w-32">
          <TextField
            label={CODE_TYPE_LABEL[procedure.codeType ?? "CPT"]}
            value={procedure.cptHint ?? ""}
            onChange={(value) => onChange({ ...procedure, cptHint: value })}
          />
          {!procedure.cptHint && (
            <OptumCodeSearch
              term={procedure.description}
              codeTypes={["cpt", "hcpcs"]}
              onSelect={onOptumSelect}
            />
          )}
        </div>
        {hasModifier && (
          <div className="w-full sm:w-20">
            <TextField
              label="Modifier"
              value={procedure.modifier ?? ""}
              onChange={(value) => onChange({ ...procedure, modifier: value })}
            />
          </div>
        )}
        {hasUnits && (
          <div className="w-full sm:w-20">
            <TextField
              label="Units"
              value={String(procedure.units ?? "")}
              onChange={(value) => {
                const units = Number(value);
                onChange({
                  ...procedure,
                  units: Number.isFinite(units) ? units : procedure.units,
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

