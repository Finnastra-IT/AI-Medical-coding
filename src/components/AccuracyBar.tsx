import type { SuggestedCode } from "@/lib/types";

interface AccuracyBarProps {
  codes: SuggestedCode[];
  onExport: () => void;
}

const KEPT_STATUSES: SuggestedCode["status"][] = ["accepted", "modified"];

export default function AccuracyBar({ codes, onExport }: AccuracyBarProps) {
  // "Suggested" = algorithmically sourced (AI or Optum), as opposed to a code
  // the coder typed in themselves.
  const suggestedCodes = codes.filter((code) => code.source !== "Manual");
  const acceptedSuggestedCodes = suggestedCodes.filter((code) =>
    KEPT_STATUSES.includes(code.status)
  );
  const finalCodes = codes.filter((code) => KEPT_STATUSES.includes(code.status));

  const precision =
    suggestedCodes.length > 0
      ? Math.round((acceptedSuggestedCodes.length / suggestedCodes.length) * 100)
      : 0;
  const recall =
    finalCodes.length > 0
      ? Math.round((acceptedSuggestedCodes.length / finalCodes.length) * 100)
      : 0;

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <Stat label="Final codes" value={finalCodes.length.toString()} />
          <Stat label="Precision" value={`${precision}%`} accent="teal" />
          <Stat label="Recall" value={`${recall}%`} accent="teal" />
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Export Summary
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "teal";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={
          accent === "teal"
            ? "text-base font-semibold text-teal-700"
            : "text-base font-semibold text-slate-800"
        }
      >
        {value}
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
