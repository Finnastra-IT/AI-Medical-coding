# Project Conventions — MediCode AI

This section is hand-maintained. It exists so
that any agent picking up this repo can orient quickly. **Whenever you add a feature,
introduce a new pattern, or change a convention described below, update this section in
the same change** — treat it as part of the diff, not a follow-up.

## What this app is

A single-page **reference tool** for a medical coder: paste a SOAP note → AI-structured
clinical summary, **with OpenAI already assigning a code to each diagnosis and
procedure as part of that same analysis (Step 1)** → those codes populate the Suggested
Codes table automatically, no extra click needed → coder can add a code manually if the
AI missed one → optionally, "Get Codes via Optum" (Step 2, currently returns "coming
soon" — see below) adds a second, independently-sourced set of coded suggestions into
the same table. See `src/app/page.tsx` for the end-to-end flow, especially
`codesFromSummary` (the Step 1 → codes-table bridge).

This is deliberately **reference-only, not a review workflow**: the app does not track
accept/reject/modify decisions or any accuracy score — see "Reference-only tool" below
for what used to be here and why it was removed.

Codes aren't limited to plain ICD-10/CPT: the model also distinguishes the encounter's
own **E/M code** (evaluation & management level, e.g. 99214) from other **CPT** Level I
procedures and from **HCPCS Level II** codes (alphanumeric, for drugs/supplies/DME/
ambulance), and attaches a **modifier** and/or **units** to a procedure when the note
supports one. See "Domain model quirks worth knowing" below for the full shape.

The model doesn't just transcribe whatever code the note already has, either — see
"Codes are validated, not copied" below.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript (`strict: true`, no `any`)
- Tailwind CSS v4 (utility classes only — no CSS modules, no styled-components)
- Zod for request validation, Axios for the HTTP client, react-hot-toast for toasts
- `openai` — official OpenAI SDK (v7, Responses API), used server-side only in
  `src/lib/openai.ts`
- Package manager: pnpm. Path alias `@/*` → `./src/*`

## Directory layout

- `src/app/` — routes, `layout.tsx`, `globals.css`. `page.tsx` is the single client-side
  workspace and owns all top-level state (soap note, summary, codes, loading/error
  flags). Components stay controlled/presentational and receive handlers as props —
  don't reach for global state or context unless a second page needs to share it.
- `src/app/api/*/route.ts` — Next.js Route Handlers. Each validates its body with a Zod
  schema from `lib/schemas.ts` and returns `NextResponse.json(...)`.
- `src/components/` — one component per file, small and focused. A component with a
  loading state exports its skeleton as a named export alongside the default export
  (e.g. `SummaryPanelSkeleton`, `CodesTableSkeleton`) rather than a separate file.
- `src/lib/types.ts` — hand-written TS interfaces (the domain model). This is the source
  of truth for shapes; don't infer types from Zod schemas or duplicate them ad hoc.
- `src/lib/schemas.ts` — Zod schemas mirroring `types.ts`, used only for validating
  incoming API request bodies (not for client-side form validation).
- `src/lib/api.ts` — the only place that calls `axios` / hits `/api/*`. Components and
  `page.tsx` call these functions, never `fetch`/`axios` directly. `getErrorMessage`
  centralizes turning a caught error into a user-facing string.
- `src/lib/placeholders.ts` — `SOAP_NOTE_PLACEHOLDER`, the example text shown as the
  textarea's `placeholder` in `SoapInput.tsx`. This is illustrative UI copy, not mock
  data — **there is no mock data or `MOCK_MODE` anywhere in this app**; both routes
  always hit their real backend (or report "coming soon" if it isn't wired up yet, see
  below). Don't reintroduce a mock path without being explicitly asked.

## API routes: one live, one "coming soon"

- `POST /api/analyze` → **live, always**. Calls OpenAI via `analyzeWithOpenAI` in
  `src/lib/openai.ts`, using `OPENAI_API_KEY` (and optional `OPENAI_MODEL`, default
  `gpt-5.4-mini` — chosen for interactive-latency structured extraction; bump to a
  `-pro` tier via env if accuracy matters more than speed) from `process.env` —
  server-side only, never exposed to the client. It uses the Responses API's
  `responses.parse` with `zodTextFormat(clinicalSummarySchema, ...)` (from
  `openai/helpers/zod`) for strict structured JSON output — the SDK validates against
  the schema and returns `response.output_parsed` already typed, so there's no manual
  `JSON.parse`/`safeParse` step here. On failure it returns `502` with a message.
- `POST /api/generate-codes` → **not implemented yet — always returns `501` with
  `{ error: "Optum integration is coming soon." }`** after validating the request body.
  This is intentional, not a bug: it's the optional Step 2 ("Get Codes via Optum"), and
  real `OPTUM_CLIENT_ID` / `OPTUM_CLIENT_SECRET` credentials haven't been provisioned.
  When they are, implement a `lib/optum.ts` helper following the same shape as
  `lib/openai.ts` (validate its output against `SuggestedCode[]`, throw a clear `Error`
  on failure so the route can map it to `502`), swap the `NextResponse.json(...501...)`
  for the real call, and update this note — don't leave it saying "coming soon" once
  it's live. The frontend already has correct handling for both outcomes (see
  `handleGenerateCodes` in `page.tsx`): on success it appends returned codes to the
  table tagged `source: "Optum"`; on failure it calls `toast.error(...)` with the
  message. No frontend change should be needed to go live here.

Keep the Zod validation at the top of each handler, and update `.env.example` (with a
blank placeholder — never a real value) if you add new env vars.

**Secret hygiene**: `.env.example` is tracked in git (see the `!.env.example` line in
`.gitignore`) — it must only ever contain blank placeholders. Real values, including
ones a user pastes into chat, go in `.env.local` (gitignored) instead.

## PHI / name handling on `/api/analyze` — tried, reverted, revisit with care

A regex-based pre-check (`detectPersonName`, formerly `src/lib/phi.ts`) used to scan the
raw SOAP note and hard-reject anything that looked like a person's name before any LLM
call. It was removed because it wasn't reliable enough in practice (see the deleted
file's history for the approach). The only guard left is a soft one: the system
instruction in `lib/openai.ts` tells the model never to emit a person's name in its
output. **The raw note itself is not currently screened for names before being sent to
OpenAI** — if that's a hard requirement again, a regex heuristic alone was already tried
and found lacking; consider a proper PHI/NER approach (or at least tightening the
heuristic with real test notes before re-enabling a hard block) rather than restoring
the same pattern unchanged.

## Non-medical input is hard-rejected — the gate lives in the model, not a regex

`POST /api/analyze` refuses to analyze input that isn't a genuine clinical note (a
random question, an off-topic request, a prompt-injection attempt like "ignore
previous instructions...", casual conversation, etc.). Unlike the PHI check above,
this is **not** a regex pre-filter — the same OpenAI call already analyzing the note
first decides `isMedicalNote`/`rejectionReason` (required fields on
`openAiClinicalSummarySchema` in `lib/openai.ts`, instructed at the very top of
`SYSTEM_INSTRUCTION`, before any of the actual analysis instructions). When the model
says it isn't medical, `analyzeWithOpenAI` throws `NotMedicalNoteError` (exported from
`lib/openai.ts`) with the model's one-sentence reason as the message; the route maps
that specific error type to `400` (a real analysis failure stays `502`). The frontend
needed zero changes for this — `handleAnalyze`'s existing catch block already turns
any thrown error into a `toast.error(...)`, so the model's rejection reason surfaces
as-is. If you ever need to tighten or loosen this gate, edit the instruction text and/
or the examples of what counts as "not medical" — don't bolt on a separate regex/
keyword check in front of it; that pattern already failed once for PHI detection (see
above) for the same underlying reason: free text is too varied for a heuristic to gate
reliably, and the model doing the analysis is already the best classifier available.

## Reference-only tool — accept/reject/modify workflow and accuracy tracking removed

Earlier versions of this app had a full review workflow: each Suggested Code row had
Accept/Reject/Modify buttons (`RowActions`, `ModifyForm` in `CodesTable.tsx`), a
`CodeStatus` (`'pending' | 'accepted' | 'rejected' | 'modified'`) on every
`SuggestedCode`, and a sticky bottom `AccuracyBar` computing live Precision/Recall from
those statuses. **All of that was removed** — there is no `CodeStatus` field, no
accept/reject/modify actions, and no `AccuracyBar` component. The app now just displays
what the AI (and optionally Optum) suggests, plus whatever the coder adds manually via
"Add missed code"; the coder acts on the codes outside this tool. This was an explicit
product decision ("this platform is for reference only"), not an oversight — don't
reintroduce status tracking, row actions, or an accuracy/precision-recall score without
being asked again, even though it's a natural-looking feature to add back. The "Export
Summary" button (still present, now in `CodesTable.tsx`'s header) survived the removal
since it's a separate feature from accuracy tracking.

## Codes are validated, not copied

`lib/openai.ts`'s prompt does NOT treat a code already written in the note as
automatically correct. Providers can mis-code too (wrong specificity, stale copy-paste
from another visit, etc.), so for both `Diagnosis.icd10Hint` and `Procedure.cptHint` the
model is instructed to independently work out the correct code from what's actually
documented, then compare that against any code the note already states:
- If they agree, use the note's code.
- If they disagree, use the code the model determined to be correct, and add a
  `clarificationsNeeded` item flagging the discrepancy in plain language so the coder
  knows to double-check it with the provider — the model doesn't silently overwrite a
  provider's code without a trace.
- If the model can't confidently determine a correct code either way, the field is left
  `null` (never fabricated) and a `clarificationsNeeded` item asks for whatever's
  missing.

This replaced an earlier, briefer rule that said to always carry a note-provided code
through verbatim without checking it — that was discarded specifically because it made
the app a rubber stamp for a doctor's documentation mistakes instead of a coder's
independent check. If you touch this logic again, keep the "verify, don't blindly
trust either party" framing rather than defaulting back to verbatim copy.

## Domain model quirks worth knowing

- `Diagnosis.icd10Hint` and `Procedure.cptHint` — see "Codes are validated, not copied"
  above for how they're derived. The fields' internal names still say "Hint" even
  though a validated code is treated as a real assignment, not a guess — a minor
  naming mismatch, not a bug. Shown in `SummaryPanel.tsx` as "ICD-10 Code" / "CPT Code" / "HCPCS Code" /
  "E/M Code" fields (label picked dynamically from `codeType`), **and** these same
  values are what `codesFromSummary()` (`page.tsx`) turns into the initial
  `source: "AI"` rows of the Suggested Codes table right after analysis — the two
  displays share one source of truth, so don't let them drift (e.g. if you ever stop
  requesting these fields from OpenAI, `codesFromSummary` will just produce fewer rows,
  which is fine, but if you rename/restructure them, update `codesFromSummary` too).
- `Procedure.codeType?: "CPT" | "HCPCS" | "E/M"` (absent = "CPT") tells you which code
  family `cptHint` is drawn from. The model is instructed to give the encounter's own
  E/M visit level its own `procedures` entry (`codeType: "E/M"`) alongside — not instead
  of — any other procedures performed, and to classify drugs/supplies/DME/ambulance as
  `"HCPCS"` rather than `"CPT"`. `Procedure.modifier` (e.g. `"25"`, `"59"`, `"RT"`) and
  `Procedure.units` are both optional and only populated when the note's circumstances
  genuinely call for one — the model is told not to default `units` to `1` or invent a
  modifier just to fill the field. `CodeType`/`SuggestedCode` carry the same
  `modifier`/`units` fields for the codes table; `codesFromSummary` passes them through
  unchanged. Manual codes support the same fields via `AddCodeRow` in `CodesTable.tsx`
  (its type select includes all four `CodeType`s; modifier/units inputs only appear for
  non-ICD-10 types, since modifiers/units are a CPT/HCPCS/E-M concept, not a diagnosis
  one). In the table, the Modifier/Units columns themselves only render when at least
  one visible code actually has one (`hasModifierOrUnits` in `CodesTable.tsx`) — this is
  the same "shown in UI if the details are present" pattern as collapsed Negations
  below, so a note with no modifiers/units doesn't grow two dash-filled columns.
- `SuggestedCode.source` is `'AI' | 'Optum' | 'Manual'`. `'AI'` rows come from Step 1
  (`codesFromSummary`, populated automatically on analyze). `'Optum'` rows come from
  Step 2 (`handleGenerateCodes` in `page.tsx`, the optional "Get Codes via Optum"
  button — currently always errors since `/api/generate-codes` isn't implemented, see
  above). `'Manual'` is a coder-typed addition (via `AddCodeRow`/`handleAddManual`);
  there's no default status attached to it — see "Reference-only tool" above, there
  is no `CodeStatus` concept anymore.
- `ClinicalSummary.briefSummary` — despite the name, this is a **crisp clinical
  impression, not a sentence**: a few words naming the primary diagnosis/complaint
  (e.g. "Lower back pain", "Type 2 diabetes with neuropathy"), the way a coder would
  title the chart at a glance — not a restatement of the note, never a full sentence
  with a verb. Rendered in `SummaryPanel.tsx` as a single-line field labeled
  "Impression" (distinct from the itemized "Diagnoses" list below it).
- `ClinicalSummary.clarificationsNeeded` — follow-up questions for the provider, but
  only when the model genuinely can't reach a conclusion on something coding-relevant
  (not for minor ambiguity); empty when nothing is genuinely unresolved, never a
  reason to leave other fields blank. Since "Codes are validated, not copied" (above)
  can add a full-sentence discrepancy explanation here, these items are often longer
  than the note's other short fields. Rendered in `SummaryPanel.tsx` as a numbered,
  read-only list inside an amber "Needs Clarification (N)" callout — plain wrapped
  `<p>` text, not an `<input>` — specifically because a single-line input truncated/
  scrolled long sentences instead of showing them; don't revert to an editable input
  here without solving that wrapping problem too. It's collapsible (`clarificationsOpen`
  state, defaults to `true`/expanded since these are actionable, unlike Negations
  below) via the same "+"/"×" toggle pattern; the toggle button itself only renders
  when there's at least one item (collapsing an empty "No clarifications needed" line
  has no value).
- `SummaryPanel.tsx`'s "Negations" field group is collapsed by default (a `useState`
  toggle, `negationsOpen`) behind a small "+" button that rotates into an "×" when
  open — this is deliberate, to keep the main summary view uncluttered; negations are
  useful to confirm but rarely the coder's primary focus. `FieldGroup` takes an
  optional `action` node rendered next to its label for this kind of per-section
  control; follow that pattern (rather than a one-off layout) if another section needs
  similar collapse/expand behavior — Needs Clarification (above) reuses it too, just
  with a different default and an amber-tinted toggle button to match its callout.

## UI/styling conventions

- Palette: `bg-slate-50` app background, `teal-600` primary accent, amber = needs
  attention (HCPCS badge, Needs Clarification callout). Cards: white, `rounded-xl`,
  `border-slate-200`, `shadow-sm`.
- Every interactive element needs visible hover/focus/disabled states
  (`focus-visible:ring-2` pattern used throughout).
- Icon-only buttons need `aria-label` (see the negations expand/collapse button in
  `SummaryPanel.tsx`). No icon library is installed — icons are small inline SVGs
  local to the component that uses them; don't add an icon dependency without
  discussing it first.
- Mobile-first: components that render a table on desktop must also render a stacked
  card layout below the `sm` breakpoint (see `CodesTable.tsx`'s `CodeRow`/`CodeCard`
  split) rather than relying on horizontal scroll.
- **API/action errors surface as toasts (`toast.error(...)` from `react-hot-toast`,
  `Toaster` positioned `top-right` in `layout.tsx`), not an inline banner** — there
  used to be a dismissible `ErrorBanner` at the top of the page for this; it was
  removed because a banner pushed the whole layout down and got in the way right when
  the coder was trying to look at the result that just came back. Keep new
  error-reporting on this pattern rather than reintroducing a banner. Success toasts
  (`toast.success(...)`, e.g. after Export) use the same `Toaster` instance.

## Verifying changes

- `pnpm exec tsc --noEmit` and `pnpm run lint` should both be clean before considering a
  change done.
- For UI changes, actually exercise the flow (Analyze → edit summary → Generate Codes →
  add-manual → Export) in a browser rather than relying on types/lint alone — code
  validation/discrepancy-flagging logic and the conditional Modifier/Units columns are
  easy to break silently without seeing real output.
