"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage, searchOptumCodes } from "@/lib/api";
import type { OptumCodeType, OptumSearchNode } from "@/lib/types";
import OptumResultNode from "./OptumResultTree";

// Per-field "search Optum for a code" widget, shown only next to a blank
// ICD-10/CPT/HCPCS field (DiagnosisEditor/ProcedureEditor in
// SummaryPanel.tsx). Real API call — see lib/optum.ts. Distinct from
// OptumLookup.tsx (the standalone, type-your-own-term lookup in
// CodesTable.tsx) and from the bulk "Get Codes via Optum" button, which is
// still a separate, stubbed-out feature. See AGENTS.md "Per-field Optum
// code search".
export default function OptumCodeSearch({
  term,
  codeTypes,
  onSelect,
}: {
  term: string;
  codeTypes: OptumCodeType[];
  onSelect: (code: string, codeType: OptumCodeType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeType, setActiveType] = useState<OptumCodeType>(codeTypes[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<OptumSearchNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape, or on a click/tap outside the widget — otherwise the
  // only way to dismiss the floating results panel was re-clicking the
  // small toggle link above it, which wasn't obvious once it was covered by
  // the open panel.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const runSearch = async (codeType: OptumCodeType) => {
    setIsLoading(true);
    setError(null);
    try {
      const nodes = await searchOptumCodes(term, codeType);
      setResults(nodes);
    } catch (err) {
      setError(getErrorMessage(err, "Optum search failed. Please try again."));
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && results === null && !isLoading) {
      void runSearch(activeType);
    }
  };

  const switchType = (codeType: OptumCodeType) => {
    setActiveType(codeType);
    setResults(null);
    void runSearch(codeType);
  };

  return (
    <div ref={containerRef} className="relative mt-1.5">
      <button
        type="button"
        onClick={toggleOpen}
        className="inline-flex items-center gap-1 rounded text-xs font-medium text-teal-700 transition-colors hover:text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <SearchIcon className="h-3 w-3" />
        {isOpen ? "Hide Optum search" : "Search Optum"}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-72 max-w-[85vw] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Optum Search
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Optum search"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <PlusIcon className="h-3 w-3 rotate-45" />
            </button>
          </div>

          {codeTypes.length > 1 && (
            <div className="mb-2 flex gap-1">
              {codeTypes.map((codeType) => (
                <button
                  key={codeType}
                  type="button"
                  onClick={() => switchType(codeType)}
                  className={[
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    activeType === codeType
                      ? "bg-teal-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {codeType.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <p className="px-1 py-2 text-xs text-slate-400">
              Searching Optum…
            </p>
          )}

          {!isLoading && error && (
            <div className="flex items-center justify-between gap-2 px-1 py-2">
              <p className="text-xs text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void runSearch(activeType)}
                className="shrink-0 text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && results && results.length === 0 && (
            <p className="px-1 py-2 text-xs text-slate-400">
              No results found.
            </p>
          )}

          {!isLoading && !error && results && results.length > 0 && (
            <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {results.map((node, index) => (
                <OptumResultNode
                  key={`${node.code}-${index}`}
                  node={node}
                  depth={0}
                  onSelect={(code) => {
                    onSelect(code, activeType);
                    setIsOpen(false);
                    toast.success(`${code} added`);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
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
