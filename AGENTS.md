# Project Conventions — MediCode AI

This section is hand-maintained. It exists so
that any agent picking up this repo can orient quickly. **Whenever you add a feature,
introduce a new pattern, or change a convention described below, update this section in
the same change** — treat it as part of the diff, not a follow-up.

## What this app is

A single-page workspace for a medical coder: paste a SOAP note → AI-structured clinical
summary, **with OpenAI already assigning a code to each diagnosis and procedure as part
of that same analysis (Step 1)** → those codes populate the Suggested Codes table
automatically, no extra click needed → coder accepts/rejects/modifies/adds codes →
optionally, "Get Codes via Optum" (Step 2, currently returns "coming soon" — see below)
adds a second, independently-sourced set of coded suggestions into the same table →
live precision/recall accuracy tracking. See `src/app/page.tsx` for the end-to-end
flow, especially `codesFromSummary` (the Step 1 → codes-table bridge).

Codes aren't limited to plain ICD-10/CPT: the model also distinguishes the encounter's
own **E/M code** (evaluation & management level, e.g. 99214) from other **CPT** Level I
procedures and from **HCPCS Level II** codes (alphanumeric, for drugs/supplies/DME/
ambulance), and attaches a **modifier** and/or **units** to a procedure when the note
supports one. See "Domain model quirks worth knowing" below for the full shape.

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

## Domain model quirks worth knowing

- `Diagnosis.icd10Hint` and `Procedure.cptHint` are populated by `lib/openai.ts`'s
  prompt with a strict priority order: **(1)** if the note itself already states a
  code for that diagnosis/procedure, the model must carry it through verbatim — never
  replace or "correct" a code the note already provides; **(2)** otherwise, assign
  the model's own best-judgment code, but only when it's genuinely confident;
  **(3)** if it isn't confident, leave the field `null` rather than guess. This was a
  deliberate tightening — an earlier version of the prompt said "give your best
  judgment, only null if truly nothing applies," which pushed the model to fabricate
  a plausible-looking code under uncertainty instead of admitting it didn't know. A
  blank code a coder fills in themselves is safer than a wrong one they miss. The
  fields' internal names still say "Hint" even though a note-supplied code is treated
  as authoritative, not a guess — a minor naming mismatch, not a bug. Shown in
  `SummaryPanel.tsx` as "ICD-10 Code" / "CPT Code" / "HCPCS Code" /
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
  above). `'Manual'` is a coder-typed addition. Precision/Recall (`AccuracyBar.tsx`)
  treat `'AI'` and `'Optum'` identically as "suggested" (i.e. not manually typed) —
  see the formula note below.
- `ClinicalSummary.briefSummary` — despite the name, this is a **crisp clinical
  impression, not a sentence**: a few words naming the primary diagnosis/complaint
  (e.g. "Lower back pain", "Type 2 diabetes with neuropathy"), the way a coder would
  title the chart at a glance — not a restatement of the note, never a full sentence
  with a verb. Rendered in `SummaryPanel.tsx` as a single-line field labeled
  "Impression" (distinct from the itemized "Diagnoses" list below it).
- `ClinicalSummary.clarificationsNeeded` — follow-up questions for the provider, but
  only when the model genuinely can't reach a conclusion on something coding-relevant
  (not for minor ambiguity); empty when nothing is genuinely unresolved, never a
  reason to leave other fields blank. Rendered as an amber "Needs Clarification"
  callout.
- `CodeStatus` is `'pending' | 'accepted' | 'rejected' | 'modified'`. `'modified'` is
  treated as "kept" for accuracy purposes, same as `'accepted'` — see
  `KEPT_STATUSES` in `src/components/AccuracyBar.tsx`.
- Precision/Recall (`AccuracyBar.tsx`): `Precision = accepted-or-modified suggested
  codes / total suggested codes`, where "suggested" means `source !== 'Manual'` (so
  both `'AI'` and `'Optum'`). `Recall = accepted-or-modified suggested codes / all
  accepted-or-modified codes (suggested + Manual)`. If you change these formulas,
  update both the code and this note.
- Manually added codes (`source: 'Manual'`) default to `status: 'accepted'` immediately
  (`handleAddManual` in `page.tsx`) since the coder is adding them directly.
- `SummaryPanel.tsx`'s "Negations" field group is collapsed by default (a `useState`
  toggle, `negationsOpen`) behind a small "+" button that rotates into an "×" when
  open — this is deliberate, to keep the main summary view uncluttered; negations are
  useful to confirm but rarely the coder's primary focus. `FieldGroup` takes an
  optional `action` node rendered next to its label for this kind of per-section
  control; follow that pattern (rather than a one-off layout) if another section needs
  similar collapse/expand behavior.

## UI/styling conventions

- Palette: `bg-slate-50` app background, `teal-600` primary accent, green = accept,
  red = reject, amber = modified. Cards: white, `rounded-xl`, `border-slate-200`,
  `shadow-sm`.
- Every interactive element needs visible hover/focus/disabled states
  (`focus-visible:ring-2` pattern used throughout).
- Icon-only buttons need `aria-label` (see `RowActions` in `CodesTable.tsx`). No icon
  library is installed — icons are small inline SVGs local to the component that uses
  them; don't add an icon dependency without discussing it first.
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
  accept/reject/modify/add-manual → Export) in a browser rather than relying on
  types/lint alone — the accuracy math and inline-edit states are easy to break silently.
