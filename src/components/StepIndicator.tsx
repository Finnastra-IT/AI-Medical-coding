interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const STEPS: { step: 1 | 2 | 3; label: string }[] = [
  { step: 1, label: "Note" },
  { step: 2, label: "Summary" },
  { step: 3, label: "Codes" },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <ol
      className="flex items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm"
      aria-label="Progress"
    >
      {STEPS.map(({ step, label }, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <li key={step} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={[
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                isCurrent
                  ? "bg-teal-600 text-white"
                  : isCompleted
                    ? "bg-teal-50 text-teal-700"
                    : "bg-slate-100 text-slate-400",
              ].join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={[
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                  isCurrent
                    ? "bg-white text-teal-600"
                    : isCompleted
                      ? "bg-teal-600 text-white"
                      : "bg-slate-300 text-white",
                ].join(" ")}
              >
                {step}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </span>
            {index < STEPS.length - 1 && (
              <span className="text-slate-300" aria-hidden="true">
                &rarr;
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
