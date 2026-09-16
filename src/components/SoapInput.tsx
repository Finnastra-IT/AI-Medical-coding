import { MOCK_SOAP_PLACEHOLDER } from "@/lib/mockData";

interface SoapInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export default function SoapInput({
  value,
  onChange,
  onAnalyze,
  isAnalyzing,
}: SoapInputProps) {
  const isEmpty = value.trim().length === 0;

  return (
    <section className="flex flex-1 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">SOAP Note</h2>
        <span className="text-xs text-slate-400">
          {value.length.toLocaleString()} characters
        </span>
      </div>

      <label htmlFor="soap-note-input" className="sr-only">
        SOAP note text
      </label>
      <textarea
        id="soap-note-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={MOCK_SOAP_PLACEHOLDER}
        className="min-h-64 w-full flex-1 resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      />

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
    </section>
  );
}
