"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage, searchOptumCodes } from "@/lib/api";
import type { CodeType, OptumCodeType, OptumSearchNode } from "@/lib/types";
import Modal from "./Modal";
import OptumResultNode from "./OptumResultTree";

const CODE_TYPES: OptumCodeType[] = ["icd10cm", "cpt", "hcpcs"];

const CODE_TYPE_LABEL: Record<OptumCodeType, CodeType> = {
  icd10cm: "ICD-10",
  cpt: "CPT",
  hcpcs: "HCPCS",
};

export default function OptumLookup({
  variant,
  onAdd,
}: {
  variant: "row" | "card";
  onAdd: (code: string, description: string, type: CodeType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [activeType, setActiveType] = useState<OptumCodeType>("icd10cm");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<OptumSearchNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const runSearch = async () => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const nodes = await searchOptumCodes(trimmed, activeType);
      setResults(nodes);
    } catch (err) {
      setError(getErrorMessage(err, "Optum search failed. Please try again."));
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchType = (codeType: OptumCodeType) => {
    setActiveType(codeType);
    setResults(null);
  };

  const close = () => {
    setIsOpen(false);
    setTerm("");
    setResults(null);
    setError(null);
    setActiveType("icd10cm");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          variant === "row"
            ? "mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            : "flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        }
      >
        <SearchIcon className="h-4 w-4" />
        Look up a code
      </button>

      {isOpen && (
        <Modal
          title="Look up a code via Optum"
          onClose={close}
          widthClassName="max-w-lg"
        >
          <div className="flex flex-col gap-3">
            <div className="flex gap-1">
              {CODE_TYPES.map((codeType) => (
                <button
                  key={codeType}
                  type="button"
                  onClick={() => switchType(codeType)}
                  className={[
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    activeType === codeType
                      ? "bg-teal-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {CODE_TYPE_LABEL[codeType]}
                </button>
              ))}
            </div>

            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch();
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="e.g. conjunctivitis, wheelchair, office visit"
                aria-label="Code search term"
                className="w-full flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
              <button
                type="submit"
                disabled={!term.trim() || isLoading}
                className="shrink-0 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Search
              </button>
            </form>

            {isLoading && (
              <p className="px-1 py-1 text-xs text-slate-400">
                Searching Optum…
              </p>
            )}

            {!isLoading && error && (
              <div className="flex items-center justify-between gap-2 px-1 py-1">
                <p className="text-xs text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  className="shrink-0 text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !error && results && results.length === 0 && (
              <p className="px-1 py-1 text-xs text-slate-400">
                No results found.
              </p>
            )}

            {!isLoading && !error && results && results.length > 0 && (
              <ul className="flex flex-col gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-1">
                {results.map((node, index) => (
                  <OptumResultNode
                    key={`${node.code}-${index}`}
                    node={node}
                    depth={0}
                    onSelect={(code, desc) => {
                      onAdd(code, desc, CODE_TYPE_LABEL[activeType]);
                      toast.success(`${code} added`);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
