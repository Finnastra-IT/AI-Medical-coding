import StepIndicator from "./StepIndicator";

interface HeaderProps {
  currentStep: 1 | 2 | 3;
}

export default function Header({ currentStep }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
            <StethoscopeIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-slate-900">
              MediCode AI
            </h1>
            <p className="text-xs leading-tight text-slate-500">
              AI-Assisted Medical Coding{" "}
              <span className="text-slate-400">· Finnastra</span>
            </p>
          </div>
        </div>
        <StepIndicator currentStep={currentStep} />
      </div>
    </header>
  );
}

function StethoscopeIcon({ className }: { className?: string }) {
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
      <path d="M4.8 2.3v6.4a4.7 4.7 0 0 0 9.4 0V2.3" />
      <path d="M9.5 15.5a6.7 6.7 0 0 0 6.7-6.7" />
      <path d="M16.2 15.5a3.8 3.8 0 1 0 0 7.5 3.8 3.8 0 0 0 0-7.5Z" />
      <path d="M4.8 4.6H3" />
      <path d="M14.2 4.6H16" />
    </svg>
  );
}
