interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  /** Shows an amber count badge on the Summary pill when > 0. */
  clarificationsCount?: number;
}

// Each step's section id on the single-scroll page (page.tsx) — an implicit
// contract between the two files, not a prop, so StepIndicator stays
// self-contained. scroll-mt-28 on those sections (see page.tsx) keeps the
// sticky header from covering the jumped-to content.
const STEPS: { step: 1 | 2 | 3; label: string; sectionId: string }[] = [
  { step: 1, label: "Note", sectionId: "note-section" },
  { step: 2, label: "Summary", sectionId: "summary-section" },
  { step: 3, label: "Codes", sectionId: "codes-section" },
];

export default function StepIndicator({
  currentStep,
  clarificationsCount = 0,
}: StepIndicatorProps) {
  return (
    <ol
      className="flex items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm"
      aria-label="Progress"
    >
      {STEPS.map(({ step, label, sectionId }, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        // A step's section only exists once that step has been reached —
        // only make it a real jump-link then, rather than linking to
        // content that isn't on the page yet.
        const isReachable = step <= currentStep;
        const showBadge = step === 2 && clarificationsCount > 0;

        const pill = (
          <span
            className={[
              "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
              isCurrent
                ? "bg-teal-600 text-white"
                : isCompleted
                  ? "bg-teal-50 text-teal-700"
                  : "bg-slate-100 text-slate-400",
              isReachable && "hover:ring-2 hover:ring-teal-500/30",
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
            {showBadge && (
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-amber-900"
                aria-label={`${clarificationsCount} item${clarificationsCount === 1 ? "" : "s"} need clarification`}
              >
                {clarificationsCount}
              </span>
            )}
          </span>
        );

        return (
          <li key={step} className="flex items-center gap-1.5 sm:gap-2">
            {isReachable ? (
              <a
                href={`#${sectionId}`}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-full"
              >
                {pill}
              </a>
            ) : (
              pill
            )}
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
