"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Generic modal shell — backdrop + centered dialog, portaled to <body> so it
// always sits above the rest of the page regardless of where it's rendered
// from. Closes on Escape, on a backdrop click, or the "×" button. Locks
// background scroll while open. First user: OptumLookup.tsx's standalone
// code search — reach for this instead of a one-off overlay if another
// feature needs a modal.
export default function Modal({
  title,
  onClose,
  children,
  widthClassName = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[85vh] w-full ${widthClassName} flex-col overflow-hidden rounded-xl bg-white shadow-xl focus:outline-none`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function CloseIcon({ className }: { className?: string }) {
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
