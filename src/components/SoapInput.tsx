"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  getErrorMessage,
  importNoteFile,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "@/lib/api";
import { deidentifySoapNote } from "@/lib/deidentify";
import { SOAP_NOTE_PLACEHOLDER } from "@/lib/placeholders";

interface SoapInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onReset: () => void;
  canReset: boolean;
  isAnalyzing: boolean;
}

export default function SoapInput({
  value,
  onChange,
  onAnalyze,
  onReset,
  canReset,
  isAnalyzing,
}: SoapInputProps) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEmpty = value.trim().length === 0;

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await importNoteFile(file);
      onChange(text);
      toast.success(`Imported ${file.name}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not import that file."));
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    onReset();
    toast.success("Cleared note, summary, and codes");
  };

  const handleClean = () => {
    const { cleaned, identifiersFound, mentionsRedacted } =
      deidentifySoapNote(value);
    onChange(cleaned);

    if (identifiersFound === 0) {
      toast(
        "No identifying details recognized — please check the note manually before analyzing.",
        { icon: "⚠️" }
      );
    } else {
      toast.success(
        `Found ${identifiersFound} identifying detail${identifiersFound === 1 ? "" : "s"}, redacted ${mentionsRedacted} mention${mentionsRedacted === 1 ? "" : "s"}.`
      );
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">SOAP Note</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {value.length.toLocaleString()} characters
          </span>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-2.5 py-1 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            <ImportIcon className="h-3.5 w-3.5" />
            {isImporting ? "Importing…" : "Import"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_IMPORT_EXTENSIONS.join(",")}
            onChange={(event) => void handleFileChange(event)}
            className="hidden"
          />
        </div>
      </div>

      <label htmlFor="soap-note-input" className="sr-only">
        SOAP note text
      </label>
      <textarea
        id="soap-note-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={SOAP_NOTE_PLACEHOLDER}
        className="min-h-64 w-full flex-1 resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleClean}
          disabled={isEmpty}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          <SparkleIcon className="h-4 w-4" />
          Clean Note
        </button>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={isEmpty || isAnalyzing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isAnalyzing && (
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
          {isAnalyzing ? "Analyzing..." : "Analyze Note"}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={!canReset || isAnalyzing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          <ResetIcon className="h-4 w-4" />
          Reset
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Run &ldquo;Clean Note&rdquo; to strip patient-identifying details
        before analyzing — always review the result yourself first.
      </p>
    </section>
  );
}

function ImportIcon({ className }: { className?: string }) {
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ResetIcon({ className }: { className?: string }) {
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
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
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
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
