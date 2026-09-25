"use client";

import { useState } from "react";
import type { OptumSearchNode } from "@/lib/types";

// Recursive renderer for an Optum term-search result tree. A node with an
// empty `node` array is a real, selectable code (a leaf); anything else is a
// grouping/range node (e.g. "K0001-K0195") that exists only to organize the
// tree and isn't itself selectable. Shared between the per-field search
// (OptumCodeSearch.tsx) and the standalone lookup (OptumLookup.tsx) — see
// AGENTS.md "Per-field Optum code search" / "Standalone Optum code lookup".
export default function OptumResultNode({
  node,
  depth,
  onSelect,
}: {
  node: OptumSearchNode;
  depth: number;
  onSelect: (code: string, desc: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.node.length > 0;
  const indent = { paddingLeft: `${depth * 12 + 6}px` };

  if (!hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(node.code, node.desc)}
          style={indent}
          className="flex w-full items-start gap-2 rounded-md py-1 pr-1.5 text-left text-xs transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <span className="shrink-0 font-mono font-medium text-teal-700">
            {node.code}
          </span>
          <span className="text-slate-600">{node.desc}</span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={indent}
        aria-expanded={expanded}
        className="flex w-full items-start gap-1.5 rounded-md py-1 pr-1.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <PlusIcon
          className={`mt-0.5 h-2.5 w-2.5 shrink-0 transition-transform ${expanded ? "rotate-45" : ""}`}
        />
        <span className="font-mono">{node.code}</span>
        <span className="font-normal text-slate-500">{node.desc}</span>
      </button>
      {expanded && (
        <ul className="flex flex-col gap-0.5">
          {node.node.map((child, index) => (
            <OptumResultNode
              key={`${child.code}-${index}`}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
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
