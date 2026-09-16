# Project Conventions — MediCode AI

This section is hand-maintained. It exists so
that any agent picking up this repo can orient quickly. **Whenever you add a feature,
introduce a new pattern, or change a convention described below, update this section in
the same change** — treat it as part of the diff, not a follow-up.

## What this app is

A single-page workspace for a medical coder: paste a SOAP note → AI-structured clinical
summary → AI-suggested ICD-10/CPT codes → coder accepts/rejects/modifies/adds codes →
live precision/recall accuracy tracking. See `src/app/page.tsx` for the end-to-end flow.

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
- `src/lib/mockData.ts` — realistic mock summary/codes used by the API routes while
  `MOCK_MODE=true`.

## API routes: one live, one still mocked

Both routes are gated by `MOCK_MODE` (`.env.local`/`.env.example`): `MOCK_MODE=true` (or
unset) returns canned data after an artificial 1.5s delay; `MOCK_MODE=false` calls the
real backend.

- `POST /api/analyze` → **live**. When not mocked, it calls OpenAI via
  `analyzeWithOpenAI` in `src/lib/openai.ts`, using `OPENAI_API_KEY` (and optional
  `OPENAI_MODEL`, default `gpt-5.4-mini` — chosen for interactive-latency structured
  extraction; bump to a `-pro` tier via env if accuracy matters more than speed) from
  `process.env` — server-side only, never exposed to the client. It uses the Responses
  API's `responses.parse` with `zodTextFormat(clinicalSummarySchema, ...)` (from
  `openai/helpers/zod`) for strict structured JSON output — the SDK validates against
  the schema and returns `response.output_parsed` already typed, so there's no manual
  `JSON.parse`/`safeParse` step here (unlike a hand-rolled integration). On failure it
  returns `502` with a message (no silent fallback to mock).
- `POST /api/generate-codes` → still mocked. Real integration is Optum, gated on
  `OPTUM_CLIENT_ID` / `OPTUM_CLIENT_SECRET`, not yet implemented — no credentials
  configured yet. Follow the same pattern as `analyze` when wiring it up: a
  `lib/optum.ts` helper, validate its output against the `SuggestedCode[]` shape, gate
  on `MOCK_MODE`, return `502` on failure rather than silently mocking.

Keep the Zod validation at the top of each handler, keep the response shape identical
to the mock (so the frontend doesn't need to change), and update `.env.example` (with a
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

## Domain model quirks worth knowing

- `Diagnosis.icd10Hint` and `Procedure.cptHint` still exist as optional fields on the
  domain model (`types.ts`/`schemas.ts`), but are currently **not populated or shown**:
  `lib/openai.ts`'s request schema and prompt deliberately omit them, and
  `SummaryPanel.tsx`'s `DiagnosisEditor`/`ProcedureEditor` don't render an input for
  them. This is intentional, not an oversight — actual coding is deferred to a
  dedicated coding API (Optum) at the Generate Codes step; asking the analysis LLM to
  guess codes it isn't authoritative for added noise without value. If/when that
  changes, re-add the field to `openAiClinicalSummarySchema` + prompt and the UI in the
  same change (don't leave one side stale).
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
- Precision/Recall (`AccuracyBar.tsx`): `Precision = accepted-or-modified AI codes /
  total AI-suggested codes`. `Recall = accepted-or-modified AI codes / all
  accepted-or-modified codes (AI + Manual)`. If you change these formulas, update both
  the code and this note.
- Manually added codes (`source: 'Manual'`) default to `status: 'accepted'` immediately
  (`handleAddManual` in `page.tsx`) since the coder is adding them directly.

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

## Verifying changes

- `pnpm exec tsc --noEmit` and `pnpm run lint` should both be clean before considering a
  change done.
- For UI changes, actually exercise the flow (Analyze → edit summary → Generate Codes →
  accept/reject/modify/add-manual → Export) in a browser rather than relying on
  types/lint alone — the accuracy math and inline-edit states are easy to break silently.
