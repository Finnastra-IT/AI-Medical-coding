import type { SuggestedCode } from "./types";

// Shared by CodesTable.tsx (the on-screen "Dx Ref" column) and
// excelExport.ts (the same values written to the exported .xlsx) — kept in
// one place specifically so the two never drift apart. See AGENTS.md
// "Diagnosis pointer hint" for the full picture.

// CMS-1500 Box 21 letters (A-L) assigned to whichever ICD-10 rows are
// actually in THIS table, in table order — includes Manual/Optum diagnosis
// rows, not just AI ones, since all of them would appear on the real claim.
// Recompute from the live `codes` array every time you need it (on every
// render in the UI, and once per export call here) so it self-corrects as
// rows are added.
export function computeDiagnosisLetters(
  codes: SuggestedCode[]
): Map<string, string> {
  const letters = new Map<string, string>();
  let index = 0;
  for (const code of codes) {
    if (code.type !== "ICD-10") continue;
    if (index >= 12) break;
    letters.set(code.id, String.fromCharCode(65 + index));
    index += 1;
  }
  return letters;
}

// For a diagnosis row, its own letter (e.g. "A"). For a procedure row, the
// comma-joined letters of whichever `linkedDiagnosisIds` resolve to a
// diagnosis row currently in the table — a diagnosis still missing a code
// (so no row/letter exists yet) is silently omitted rather than shown as a
// broken reference.
export function resolveDxReference(
  code: SuggestedCode,
  letters: Map<string, string>
): string | undefined {
  if (code.type === "ICD-10") {
    return letters.get(code.id);
  }
  if (!code.linkedDiagnosisIds || code.linkedDiagnosisIds.length === 0) {
    return undefined;
  }
  const resolved = code.linkedDiagnosisIds
    .map((diagnosisId) => letters.get(`ai-${diagnosisId}`))
    .filter((letter): letter is string => letter !== undefined);
  return resolved.length > 0 ? resolved.join(", ") : undefined;
}
