# Project Conventions — MediCode AI

This section is hand-maintained. It exists so
that any agent picking up this repo can orient quickly. **Whenever you add a feature,
introduce a new pattern, or change a convention described below, update this section in
the same change** — treat it as part of the diff, not a follow-up.

## What this app is

A single-page **reference tool** for a medical coder: paste a SOAP note → AI-structured
clinical summary, **with OpenAI already assigning a code to each diagnosis and
procedure as part of that same analysis** → those codes populate the Suggested Codes
table automatically, no extra click needed → coder can add a code manually if the AI
missed one, or pull one from Optum (see below). See `src/app/page.tsx` for the
end-to-end flow, especially `codesFromSummary` (the analysis → codes-table bridge).

There used to be a second, bulk "Get Codes via Optum (Optional)" button here that sent
the whole summary to `POST /api/generate-codes` for a second, independently-sourced set
of suggestions — it was removed (route deleted, button and its handler removed from
`SummaryPanel.tsx`/`page.tsx`) because that endpoint was never more than a `501` stub
("coming soon") with no concrete API behind it, unlike the two Optum features below,
which hit a real endpoint. If bulk Optum code generation is ever scoped again, it needs
a fresh design, not a revival of the old stub — don't resurrect `generateCodes`/
`GenerateCodesRequest`/`generateCodesRequestSchema` from git history without rethinking
what the endpoint should actually do.

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

Before any of that, the coder can **import** a note (.txt/.docx/.pdf) or paste one in,
then must explicitly run **"Clean Note"** to strip patient-identifying details before
Analyze is meaningful to click — see "SOAP note import & de-identification" below. This
is a real, live feature, and it's separate from — and stricter than — the older soft PHI
guard described under "PHI / name handling" below.

There are **two separate, unrelated Optum-related things** — don't conflate them (a
third, the bulk "Get Codes via Optum" button, existed earlier and was removed — see
above):
1. The per-field "Search Optum" option next to any blank ICD-10/CPT/HCPCS code — this
   one is **live**, hits Optum's real RealTime eContent term-search API, and is
   documented in full under "Per-field Optum code search" below.
2. The standalone "Look up a code" tool in the Suggested Codes table — also **live**,
   hits the same real term-search API but with a coder-typed term instead of a field's
   own text, and adds a fresh row instead of filling an existing field. Documented
   under "Standalone Optum code lookup" below.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript (`strict: true`, no `any`)
- Tailwind CSS v4 (utility classes only — no CSS modules, no styled-components)
- Zod for request validation, Axios for the HTTP client, react-hot-toast for toasts
- `openai` — official OpenAI SDK (v7, Responses API), used server-side only in
  `src/lib/openai.ts`
- `mammoth` (.docx) and `pdf-parse` (.pdf) — server-side-only text extraction for
  imported note files, used only in `api/import-note/route.ts`. `pdf-parse` (via
  `pdfjs-dist`) is listed in `next.config.ts`'s `serverExternalPackages` — bundling it
  breaks its internal worker-script lookup (see that file's comment and "SOAP note
  import & de-identification" below); don't remove that entry.
- `xlsx` (SheetJS) — client-side-only, used only in `src/lib/excelExport.ts` to read/
  write the `.xlsx` binary format for the "Export to Excel" feature. See "Exporting
  suggested codes to a persistent Excel file" below.
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
  data — **there is no mock data or `MOCK_MODE` anywhere in this app**; every route
  always hits its real backend. Don't reintroduce a mock path without being explicitly
  asked.
- `src/lib/deidentify.ts` — pure, dependency-free, framework-agnostic function
  (`deidentifySoapNote`); safe to import client- or server-side. See "SOAP note import
  & de-identification" below.
- `src/lib/excelExport.ts` — client-side-only (uses browser-only APIs; never import it
  from a route handler). Powers "Export to Excel" in `CodesTable.tsx`. See "Exporting
  suggested codes to a persistent Excel file" below.
- `src/lib/fileSystemAccess.d.ts` — minimal ambient types for the File System Access
  API (`showSaveFilePicker`, `FileSystemFileHandle.queryPermission`/
  `requestPermission`) that TypeScript's bundled `dom.d.ts` doesn't include yet.
  Scoped to exactly what `excelExport.ts` uses — extend it if that file starts using
  more of the API, don't pull in a third-party types package for this.

## API routes: all three live, no stubs

- `POST /api/analyze` → **live, always**. Calls OpenAI via `analyzeWithOpenAI` in
  `src/lib/openai.ts`, using `OPENAI_API_KEY` (and optional `OPENAI_MODEL`, default
  `gpt-5.4-mini` — chosen for interactive-latency structured extraction; bump to a
  `-pro` tier via env if accuracy matters more than speed) from `process.env` —
  server-side only, never exposed to the client. It uses the Responses API's
  `responses.parse` with `zodTextFormat(clinicalSummarySchema, ...)` (from
  `openai/helpers/zod`) for strict structured JSON output — the SDK validates against
  the schema and returns `response.output_parsed` already typed, so there's no manual
  `JSON.parse`/`safeParse` step here. On failure it returns `502` with a message.
- `POST /api/optum-search` → **live, always**. Body `{ term, codeType }` (validated by
  `optumSearchRequestSchema`), calls `searchOptumCodes` in `src/lib/optum.ts`, returns
  `{ results: OptumSearchNode[] }` or `{ error }` with `502`. This is the per-field
  "Search Optum" feature — see "Per-field Optum code search" below for the full
  picture (it is NOT the same thing as the route below).
- `POST /api/import-note` → **live, always**. Takes a `multipart/form-data` upload
  (field name `file`), extracts plain text from a `.docx` (via `mammoth`) or `.pdf`
  (via `pdf-parse`), returns `{ text }` or `{ error }` with `502`. **This is the one
  route that doesn't validate via a `lib/schemas.ts` Zod schema** — it's a file upload,
  not a JSON body, so it just checks the file exists and is under 10MB by hand; there's
  no secret/AI call here, just local text extraction on our own server. `.txt` files
  never reach this route — `SoapInput.tsx` reads those directly in the browser via
  `file.text()`. See "SOAP note import & de-identification" below.
**`POST /api/generate-codes` was removed** — it was the optional bulk "Get Codes via
Optum" button's endpoint, but it never got past a `501` ("coming soon") stub since
nobody defined what a whole-summary-to-codes Optum call should look like. The route
file, `handleGenerateCodes`/the button in `page.tsx`/`SummaryPanel.tsx`, the
`generateCodes` client function in `lib/api.ts`, `GenerateCodesRequest` in
`lib/types.ts`, and `generateCodesRequestSchema` in `lib/schemas.ts` were all deleted
together — if you find a reference to any of them, it's stale and should be removed, not
reconnected. `lib/optum.ts`'s auth/token-fetch logic is untouched by this removal — it's
still very much in use by `searchOptumCodes`, which backs both live per-field/standalone
Optum features below.

Keep the Zod validation at the top of each handler, and update `.env.example` (with a
blank placeholder — never a real value) if you add new env vars.

**Secret hygiene**: `.env.example` is tracked in git (see the `!.env.example` line in
`.gitignore`) — it must only ever contain blank placeholders. Real values, including
ones a user pastes into chat, go in `.env.local` (gitignored) instead.

## PHI / name handling on `/api/analyze` — tried, reverted, revisit with care

A regex-based pre-check (`detectPersonName`, formerly `src/lib/phi.ts`) used to scan the
raw SOAP note and hard-reject anything that looked like a person's name before any LLM
call. It was removed because it wasn't reliable enough in practice (see the deleted
file's history for the approach). At the time, the only guard left was a soft one: the
system instruction in `lib/openai.ts` telling the model never to emit a person's name in
its output — the raw note itself wasn't screened before being sent to OpenAI.

**That hard requirement came back** — see "SOAP note import & de-identification" below,
which is a deliberately different strategy from the reverted `detectPersonName` attempt
(scrub known-labeled fields + their exact values, rather than trying to detect "is this
a name" in arbitrary free text) precisely because free text alone was already tried and
found lacking here. It still isn't foolproof (see that section for the honest limits) —
the soft output-side instruction in `lib/openai.ts` stays in place as a second layer,
not a replacement.

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

## SOAP note import & de-identification

Before a note goes anywhere near OpenAI, the coder can (a) **Import** a `.txt`/`.docx`/
`.pdf` file or paste text directly into `SoapInput.tsx`'s textarea, then (b) must
explicitly click **"Clean Note"**, which runs `deidentifySoapNote` (`lib/deidentify.ts`)
over the current textarea contents and replaces it with the cleaned result in place.
Analyze itself was deliberately left untouched (still just requires non-empty text) —
this is a workflow convention enforced by the UI copy and the review step, not a code
gate, per an explicit product decision; don't add a hard code-level gate forcing Clean
before Analyze without being asked.

**"Reset"** (also in `SoapInput.tsx`, next to Clean Note/Analyze Note) clears all three
pieces of top-level state at once — `soapNote`, `summary`, and `codes` — via
`handleReset` in `page.tsx`, not just the textarea; this is deliberate, since a
half-reset (e.g. clearing the note but leaving a stale summary/codes table on screen)
would be more confusing than not resetting at all. It's disabled whenever there's
nothing to reset (`canReset`, computed in `page.tsx` from all three pieces of state,
not just whether the textarea is empty — the note could be cleared by hand while a
summary/codes from an earlier analysis are still showing) and, importantly, **while
`isAnalyzing` is true** — resetting mid-request doesn't cancel the in-flight
`analyzeNote` call, so if it were allowed, a just-cleared page could get silently
overwritten a moment later when that stale response resolves and calls
`setSummary`/`setCodes`. Don't remove that `isAnalyzing` guard without also handling
that race (e.g. an abort controller) some other way.

**What "Clean Note" actually does** (`lib/deidentify.ts`, pure/dependency-free, no
network call, works on any text regardless of where it came from). Three iterations so
far, each driven by a real failure — see the full history comment at the top of that
file, summarized here:
- **v1**: single-line `Label: value` pairs against an exact label list. A real
  EHR-exported header broke every assumption at once (name in running prose with no
  label, `Label value` with no colon, unmatched label wording) — nothing got redacted.
- **v2**: added format-based detectors (name shape, DOB, ID, SSN, phone, email) plus a
  keyword-contains label scanner, and replaced matched values **in place**, broadcasting
  every match across the whole document. That broadcast was itself a bug: a pharmacy
  address like `"ALEXANDRIA, VA"` has the exact same shape as a patient's `"SURNAME,
  First"` name, so it false-positive-matched — and because matches were replaced
  *everywhere*, the unrelated `"VA"` in the clinic's own address at the top got wiped
  too. Partial, in-place redaction of a fundamentally noisy administrative block turned
  out to be the wrong strategy, not just under-tuned.
- **v3**: stopped trying to surgically redact values inside
  administrative/demographic content and instead **drops that content wholesale** —
  none of a scheduling header, insurance block, care-team roster, or pharmacy list is
  needed for coding, so there's no reason to keep fighting to redact individual values
  inside it (an explicit product decision: send *none* of it, not a redacted version of
  it). Concretely:
  1. Find the first line that looks like real clinical content (originally
     `CLINICAL_CONTENT_MARKER`, matching only a SOAP marker or "Chief
     Complaint"/"History of Present Illness"/"HPI"/"Reason for Visit" — broadened
     and renamed to `CHART_CONTENT_MARKER` in v4 below, see that entry for why).
     Everything **before** it is dropped wholesale — not redacted, removed —
     including otherwise-harmless fields like an appointment date, since the
     product call here is "don't send any of the header," not "send a scrubbed
     version of it." If no such line is found at all, nothing is dropped (safer to
     fall back to per-line scrubbing than risk deleting an entire note that just
     doesn't use recognizable section markers).
  2. In whatever comes after the header, whole lines are dropped (not redacted) when
     they're clearly administrative/contact content regardless of position: a
     `Patient's Care Team`/`Patient's Pharmacies` section title, a `Prescription:
     ... eligible` benefit-check line, or a line containing an NPI number, a `Fax
     (...)`, or a `Ph (...)` — these shapes only ever appear in provider/pharmacy
     contact blocks, never clinical narrative.
  3. Every other line is scanned for DOB/ID/SSN/phone/email shapes and PHI-labeled
     `Label: value` pairs (same keyword-contains label list as before), **strictly
     per-line** — a match is never broadcast beyond the line it's found on. If
     stripping the matched span(s) leaves nothing substantial behind
     (`lineHasSubstantialContent` — a boilerplate/filler-word check), the whole line is
     dropped; otherwise the line is kept with just that value replaced by `[PATIENT]`.
- **v3.1**: v3 only carried the patient's *name* forward from the dropped header
  (broadcasting it across the surviving clinical content so "Jane reports..." still
  got caught). Everything else extracted from the header was discarded along with
  it — so if e.g. the header's MRN showed up again in the body in a form no per-line
  detector recognized on its own (a bare number with no "mrn"/"id#" keyword next to
  it the second time), it slipped through. v3.1 stores *every* identifier
  `collectIdentifiers` finds in the header — not just the name — in
  `confirmedIdentifiers`, and broadcasts all of them the same way. Still safe against
  the v2 broadcast bug because the *source* is bounded to the header region
  specifically (already-confirmed administrative content, about to be dropped
  entirely) rather than a name-shaped match found anywhere in the document.
- **v3.2**: a real multi-page EHR export exposed two more gaps, both from
  content that recurs *past* the header/footer boundaries v3/v3.1 relied on:
  1. A clinic letterhead/address line (e.g. `"Privia - KOHU - Alexandria Medical
     Associates • 6355 Walker Lane, ALEXANDRIA VA 22310-3247"`) repeats as a running
     page header throughout the export, not just once before the clinical marker —
     so only the first occurrence (inside the dropped header) was ever caught; every
     later recurrence survived untouched. Fixed with a new whole-line drop,
     `STREET_ADDRESS_LINE`, checked position-independently like `NPI_LINE`/`FAX_LINE`
     — a `"<number> <street>, <CITY> <ST> <ZIP>"` shape only ever appears in a
     letterhead/mailing address, never clinical narrative, and it's shape-based (not
     tied to any one clinic's actual name/address, so it generalizes to other
     practices' letterheads too).
  2. Provider names in a closing "Return to Office" / "Encounter Sign-Off" block
     (follow-up scheduling instructions, sign-off attestation) were never caught,
     because `NAME_PATTERN` deliberately only runs on the header (see the
     COPD/Exacerbation note below for why) and this block sits well past it, in the
     clinical body. That block has zero coding value regardless of whose name is in
     it, so — same call as the header — it's dropped wholesale rather than patched
     with another per-line name detector. `FOOTER_MARKER` finds the first line
     matching `"Return to Office"` or `"Encounter Sign-Off"` and everything from
     there to the end of the note is removed, the same way the pre-clinical header
     is removed. Same safe-fallback rule as the header: if no such line is found,
     nothing is dropped, rather than risking truncating a note that ends differently.
- **v3.3 (current)**: the same repeating per-page banner that motivated
  `STREET_ADDRESS_LINE` above also carries the patient's own name/id/dob on every
  page (`"NAME (id #12345678, dob: 01/02/1980)"`), and a real export had this written
  in a different name order/format on one occurrence than the header's — leaving a
  partially-redacted `"[PATIENT] SURNAME (id #[PATIENT], dob: [PATIENT])"` fragment
  instead of a clean removal once broadcast only matched some of the name's tokens.
  Rather than chasing every name-formatting variant `collectIdentifiers`'s tokenizer
  might miss, this banner now gets the same wholesale-drop treatment as the
  letterhead line: `PATIENT_BANNER_LINE` matches the `"(id #..., dob:
  .../.../...)"` signature — a shape that only ever appears in this exact
  demographic banner, never clinical narrative — and drops the whole line, whatever
  name precedes it, wherever it recurs. Explicit product call (per the "remove
  entirely, don't redact-and-hope" principle above): don't depend on correctly
  tokenizing/broadcasting a name inside this banner every time; just remove it.
- **v4** fixed a much bigger problem than any single missed identifier: on
  a real ~12,500-word visit summary, Clean Note collapsed it to ~2,500 words,
  silently deleting Vitals, Allergies, Medications, Vaccines, Problems, Family
  History, Social History, Surgical History, GYN History, Obstetric History, and
  Past Medical History — all genuine, coding-relevant documentation, not
  administrative noise. The cause: the header/body boundary (previously
  `CLINICAL_CONTENT_MARKER`) only recognized narrative SOAP/HPI-style section names
  as "real clinical content starts here." On a note whose layout puts a full chart
  review *before* the HPI narrative (a very common EHR visit-summary shape), all of
  that chart review got treated as pre-clinical "header" and dropped wholesale
  right along with the actual demographic banner. Fixed by renaming it to
  `CHART_CONTENT_MARKER` and broadening it to also recognize these standard EHR
  review-section headers (Vitals, Allergies, Medications, Vaccines, Problems,
  Family/Social/Surgical/Past Medical/GYN/Obstetric History, Screening, ROS,
  Physical Exam) as equally valid starts of real documentation — narrowing the
  dropped region back down to whatever genuinely comes before the *first* real
  section (typically just a short letterhead/demographic banner, if the export even
  has one), not everything before the narrative specifically. The same real note
  also reproduced the v2 "VA" bug in a new spot: with the header containing both the
  clinic's letterhead/address and the patient banner, `NAME_PATTERN` scanning that
  whole header for "ALLCAPS, Word" shapes pulled a false identifier straight out of
  the address text, and v3.1's broadcast then replaced it everywhere — corrupting
  the clinical abbreviation `"US"` (ultrasound) and the pharmacy name `"WEGMANS
  ALEXANDRIA PHARMACY"`. Fixed by filtering `STREET_ADDRESS_LINE`/`NPI_LINE`/
  `FAX_LINE`/`PROVIDER_PHONE_LINE`/`SECTION_TITLE_LINE`/
  `PRESCRIPTION_ELIGIBILITY_LINE`-shaped lines out of the header *before* running
  `collectIdentifiers` on it, so `NAME_PATTERN` never sees that text at all.
- **v4.1 (current)**: verifying v4 against another real note surfaced a pre-existing,
  unrelated bug — a bare `"(703) 922-0264"` (the patient's own contact number) sitting
  on its own line right under Chief Complaint was never redacted at all.
  `PHONE_PATTERN`'s shared leading `\b` sat before an alternation whose first branch
  starts with `"("`, but `\b` only holds at a word/non-word transition, and `"("` is
  non-word on both sides when preceded by whitespace or line-start (the normal case)
  — so the parenthesized-format branch, `"(XXX) XXX-XXXX"`, the single most common
  US phone format, silently never matched anything, in any context, since this
  pattern was added in v2. Fixing detection surfaced a second instance of the exact
  same root cause: the per-line and header-broadcast redaction steps each rebuild a
  fresh `` `\b${escapeRegExp(value)}\b` `` from the raw matched string, which fails
  identically whenever that string itself starts or ends with a non-word character —
  so a line with other real content around the phone number would detect it but then
  silently fail to redact it. Fixed both by adding `toBoundaryPattern`, which only
  adds `\b` at an edge whose own character is a word character, and using it
  everywhere a captured identifier value gets turned into a replace pattern.
- Returns `{ cleaned, identifiersFound, mentionsRedacted }` — `SoapInput.tsx` shows a
  success toast summarizing both, or, if nothing at all was found/dropped, an explicit
  **warning** toast ("No identifying details recognized — please check the note
  manually") rather than silently doing nothing.

**Why NAME_PATTERN only ever touches header lines, never body lines** (a regression
introduced and caught while building v3, fixed before it shipped): re-running the same
name-shape check per-line on the *body* to catch local false positives seemed safe
since matches were no longer broadcast — but the pattern itself still fires on a real
clinical term shaped like "ALLCAPS, Word" (`"COPD, Exacerbation"`), and a per-line-only
match still corrupts that one line. The fix is to never run `NAME_PATTERN` outside the
dropped header at all — it exists solely to identify the confirmed patient name, not as
a general-purpose "look for names anywhere" detector.

**The honest limitation** (say this to anyone who asks, don't undersell it): this is a
pattern-matcher, not identity understanding. It cannot catch a name mentioned without a
recognized shape/label, a nickname, an unusual header wording not covered by the keyword
list, or an administrative-content shape not covered by `SECTION_TITLE_LINE`/
`NPI_LINE`/`FAX_LINE`/`PROVIDER_PHONE_LINE`. **This is not a permanent,
one-time-verify-then-forget safeguard**: the cleaned note should always be shown for the
coder to review before Analyze, every time, not just while the feature is new — three
rounds of a real, representative EHR export finding a new gap each time is exactly why.
If you're ever asked to make Clean automatic/silent or skip the review step "since it's
already reliable," push back — see "PHI / name handling" above for why a past
heuristic-only approach was explicitly abandoned here. If another real example slips
through again, that's expected — add a detector (or a whole-line drop rule) for the
specific shape that failed, the way this section's history shows; don't try to
generalize preemptively for shapes you haven't actually seen fail, and don't reach for
broadcasting a match across the whole document again without re-reading the v2 bug
above first.

**Import** (`SoapInput.tsx`'s "Import" button + hidden file input,
`SUPPORTED_IMPORT_EXTENSIONS` in `lib/api.ts`): `.txt` is read directly in the browser
via `file.text()` — no network call, no server involvement. `.docx`/`.pdf` are uploaded
to `POST /api/import-note` (see the API routes section above) since parsing those
formats needs real libraries (`mammoth`, `pdf-parse`) that only run server-side. This
does still mean the raw, un-cleaned file reaches our own backend for text extraction —
that's fine (it's our own server, not a third-party AI, and it's the same trust boundary
`/api/analyze` already operates in), but the extracted text still must go through Clean
Note before Analyze; importing does not clean automatically.

**A real bundling gotcha, already fixed — don't remove the fix**: `pdf-parse` (via
`pdfjs-dist`) locates its own worker script via a runtime require/import relative to its
package location. Bundling it (Turbopack/webpack) rewrites that path and breaks it with
`Setting up fake worker failed: Cannot find module .../pdf.worker.mjs`. Fixed by adding
`pdf-parse`/`pdfjs-dist` to `serverExternalPackages` in `next.config.ts`, which tells
Next.js to let Node resolve them straight from `node_modules` instead of bundling them.
If PDF import ever breaks with a "fake worker"/module-not-found error again after a
dependency bump, check that entry first before assuming the library itself regressed.

## Exporting suggested codes to a persistent Excel file

"Export to Excel" (`CodesTable.tsx`'s only export action) appends one row per
suggested code to a single, persistent local `.xlsx` file that accumulates across
exports/sessions, so a coder handling many cases ends up with one running workbook
rather than a new file per export — this was an explicit ask: the coder handles a lot
of these files and needs a durable, growing record, not a one-off snapshot.

**There used to be a separate "Export Summary" button** (copied the raw
`{ summary, codes }` JSON to the clipboard) — it was removed once "Export to Excel"
existed, since it covered the same underlying need (getting the coding work out of the
app) with a more useful, durable output. If you find a reference to `handleExport`/a
clipboard-JSON export anywhere, it's stale and should be removed, not reconnected;
`navigator.clipboard` isn't used anywhere in this app anymore.

**Case ID is required and deliberately not auto-generated, with no silent no-op on a
missing one.** A text input next to the export button (`caseId` state in `page.tsx`,
reset by "Reset" along with the rest of the case). The button isn't HTML-`disabled` for
this case specifically — if it were, clicking it without a Case ID would do nothing
with no feedback — instead it stays clickable, and clicking it with an empty Case ID
shows an inline amber hint (`showCaseIdHint` state in `CodesTable.tsx`, positioned
`absolute` under the input) reading "Enter a Case ID first," which disappears the
moment the coder types something. It's still rendered as disabled-*looking* (muted
gray) whenever the Case ID is empty, to signal at a glance that it's not ready, even
though it remains clickable specifically so that hint can fire. The button *is*
genuinely HTML-`disabled` for the other precondition — no codes at all to export —
since there's nothing meaningful to explain there. This was a direct product
decision: an auto-generated id (timestamp, random string) wouldn't mean
anything to the coder when they're scanning the spreadsheet later, so the field exists
specifically for the coder's own case/encounter number, typed by hand. Every appended
row is tagged with this value plus an ISO export timestamp, so rows from different
notes stay traceable in one sheet (columns: Case ID, Exported At, Code, Description,
Type, Source, Modifier, Units).

**Why this can only work in Chrome/Edge, and what that means in practice**: a web page
cannot silently read/write an arbitrary file on the user's disk — the only browser
mechanism for "pick a file once, then keep writing to that same file" is the File
System Access API (`window.showSaveFilePicker`, `FileSystemFileHandle`), which Firefox
and Safari don't implement at all. `isExcelExportSupported()` in `lib/excelExport.ts`
checks for this and `handleExportExcel` in `page.tsx` shows a plain `toast.error(...)`
explaining the browser requirement rather than failing silently or crashing. Don't try
to work around this with a plain `<a download>` blob-download approach as a
"universal" fallback — that creates a **new file every export** (defeating the one
persistent file requirement) and was explicitly not what was asked for.

**How the persistence actually works** (`lib/excelExport.ts`): the chosen
`FileSystemFileHandle` is stored in IndexedDB (`ensureFileHandle`/`getStoredHandle`/
`storeHandle`) so it survives page reloads — the coder doesn't need to re-pick the
file on every visit, only when there's no stored handle yet or the browser's grant for
it has lapsed (`queryPermission`/`requestPermission`). This is a browser security
requirement, not a bug: browsers deliberately refuse to let a page silently reopen a
previously-chosen file without this re-confirmation step, so an occasional native
permission prompt on this flow is expected, not something to "fix" away. On each
export, the existing file's current rows are read back (`readExistingRows`, via
`XLSX.read`/`sheet_to_json`) — if the file is empty or unreadable (e.g. the coder
pointed it at an unrelated file), it's treated as empty rather than failing the
export — new rows are appended in memory, and the whole workbook is rewritten via
`FileSystemWritableFileStream` (`createWritable`/`write`/`close`). There's no way to
append to an `.xlsx` file as a binary format without parsing and rewriting the whole
thing — this isn't a missed optimization.

`FileSystemFileHandle`'s permission methods and `showSaveFilePicker` aren't in
TypeScript's bundled `dom.d.ts` yet — see `lib/fileSystemAccess.d.ts` for the minimal
ambient declarations this needed; extend that file rather than reaching for a
third-party `@types` package if more of the API gets used later.

**A real testing limitation worth knowing**: `showSaveFilePicker()` opens a native
OS-level file dialog that browser automation cannot drive or dismiss (the same
limitation noted for testing file import — see "SOAP note import & de-identification"
above). Verify the UI (Case ID field, button enabled/disabled state) and the row-
building/XLSX read-write logic in isolation (e.g. a standalone script exercising
`XLSX.utils.aoa_to_sheet`/`XLSX.write`/`XLSX.read` directly) rather than trying to
automate a real click through the native picker.

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
being asked again, even though it's a natural-looking feature to add back. The export
button in `CodesTable.tsx`'s header (originally "Export Summary," a JSON-to-clipboard
copy; now "Export to Excel," see "Exporting suggested codes to a persistent Excel
file" below) survived this removal since it's a separate feature from accuracy
tracking.

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

## Resolving conflicting details within a single note

A note can contradict itself across its own sections — most commonly a stated
Postoperative Diagnosis vs. the Findings/procedure narrative that follows it, or a
Preoperative vs. Postoperative Diagnosis. `SYSTEM_INSTRUCTION` resolves this with an
explicit priority, highest first: **(1) findings-type statements** describing what was
actually observed/discovered — whether under an explicit "Findings" heading or
described elsewhere in the procedure narrative — **(2) the postoperative diagnosis**,
**(3) the preoperative diagnosis/estimate**. This only kicks in on a genuine
*conflict* (something that contradicts a higher-priority source) — most notes' findings
just add detail that agrees with the diagnosis, and the postoperative diagnosis is still
used normally in that ordinary case; don't let this instruction make the model
second-guess a diagnosis every time findings are merely present.

Two real notes drove this, both still useful as regression cases if this logic ever
needs revisiting:
- A hernia repair note: `3.5 cm` preoperative estimate vs. `12.0 cm` postoperative
  diagnosis/intraoperative finding (multiple defects combined). Preop-vs-postop
  conflict — resolved by using the confirmed `12.0 cm` figure, which flips the CPT size
  bracket from `49593` (3–10cm) to the correct `49595` (>10cm).
- A renal fluoroscopy note: Postoperative Diagnosis still read "Calculus of kidney"
  (apparently carried over unedited from the Preoperative Diagnosis), but the Findings
  explicitly stated no renal stone was identified and that the visible calcifications
  were confirmed to be outside the kidney. Findings outrank the stated postop diagnosis
  here — the model determines its best-effort diagnosis from the negative finding
  instead of defaulting to "Calculus of kidney," and always adds a
  `clarificationsNeeded` item spelling out the contradiction (e.g. "the postoperative
  diagnosis states kidney calculus, but the findings describe no renal stone
  identified — confirm the correct diagnosis") so the coder can verify with the
  provider rather than have it resolved silently.

**A real ceiling worth knowing before chasing more consistency here**: `OPENAI_MODEL`
(currently `gpt-5.6-sol` in `.env.local`, a reasoning-tier model) rejects both
`temperature` and `top_p` outright (confirmed with a direct test call — both return a
`400 Unsupported parameter` error), and the Responses API doesn't expose a `seed`
parameter at all. So there is no supported way to force full determinism via the API.
This conflict-resolution priority narrows how often the model lands on the wrong side
of a genuine contradiction, and reliably ensures the contradiction itself always gets
surfaced in `clarificationsNeeded` — but the exact fallback code it picks when a
conflict like the kidney example above occurs can still vary run to run (there isn't
always a single obvious ICD-10 code for e.g. "suspected but ruled out"). Don't treat
future variance here as evidence this instruction isn't working — check whether the
contradiction is still being *flagged* consistently before assuming it's regressed.

## A targeted fix, not a generic one — "incision" doesn't always mean an open approach

On a real sacral neuromodulation note, the model consistently (reproduced 3/3 runs)
mis-selected CPT `64581` ("Incision for implantation of neurostimulator electrode
array... sacral nerve") instead of the correct `64561` ("**Percutaneous** implantation
of neurostimulator electrode array... sacral nerve"), even generating its own
description calling the approach "incisional." The actual documented technique was
needle → guidewire → fascial dilator — standard percutaneous placement — with a small
2.0cm incision made only to visualize the guidewire/foramen externally, not to
surgically dissect down to the nerve. The model was anchoring on the literal word
"incision" appearing in the note, without registering that an incision made purely for
visualization during an otherwise needle/wire-based approach doesn't make the approach
"open."

Fixed with a narrow instruction scoped specifically to peripheral/sacral nerve
electrode/lead implantation (see the `cptHint` bullet in `SYSTEM_INSTRUCTION`), not a
sitewide rule about inferring surgical approach from keyword presence generally —
deliberately, per this file's own standing principle (see the de-identification
history above for the same lesson learned the hard way): fix the specific shape that
actually failed, don't generalize preemptively for other procedure families you
haven't actually seen fail the same way. If the same "incision ≠ open approach"
mistake turns up on an unrelated procedure later, that's the signal to generalize it
then, not now.

## Implanted device supply codes: the test is "does the procedure code already name this part," not a device allowlist

A real sacral neuromodulation note exposed a gap: the coder team confirmed that
`C1767` (the HCPCS code for the implanted Axonics generator/battery) should be
reported as its own procedure line alongside `64561`/`64590` — the model wasn't
generating it at all, likely because the bundling rule above ("don't list a minor
incidental step separately") was over-applying to it.

This went through three iterations before landing on a rule worth keeping:
1. First attempt: "implanted device/hardware" generically gets its own HCPCS line.
   Too broad — the model started also adding a supply code for the
   **electrode/lead array** (`C1778`), inconsistently (sometimes present, sometimes
   not, across otherwise-identical runs), which the coder team confirmed is wrong —
   confirmed ground truth for this note is exactly `64561`, `64590`, `C1767`,
   nothing else.
2. Second attempt: narrowed to literally "an implantable pulse generator or
   battery" by name, excluding the lead explicitly. This fixed the immediate case
   (confirmed 3/3 runs) but was a hardcoded device-type allowlist — it would have
   silently failed to catch an *unrelated* device family's generator/separately-
   costed hardware the same way, since nothing in the instruction generalized past
   "generator or battery."
3. **Current**: replaced the device-name check with a structural test — does the
   *inserting procedure's own code description* already name this exact component
   as the thing it places? A neurostimulator "electrode array" placement code
   (`64561`) already covers the lead itself, so the lead doesn't get a separate
   supply code. A "pulse generator" *insertion* code (`64590`) describes the act of
   inserting an already-manufactured device, not the device itself, so the
   generator's own cost isn't captured by that procedure code and does need its
   own line. This is the same conclusion as attempt 2 for this specific note, but
   stated as a test that applies to any device/procedure pair (a cardiac device
   generator, an infusion pump, etc.) the model hasn't been told about by name —
   not a list to extend every time a new device family shows up in a note.

Re-tested against the earlier PNS implant note (a different device family, with its
own pre-existing ambiguity — the note names three different manufacturers for the
same device: Nalu, Curonix, and Boston Scientific) to confirm attempt 2 generalized
correctly before moving to attempt 3: the model also recognized that note's
generator needs its own HCPCS line, but — since it can't confidently identify which
manufacturer's device code applies — it left the code blank and added a
`clarificationsNeeded` item asking for the device identity, rather than guessing.
That's the intended behavior from the "never guess a code you're not confident in"
instruction, not a gap. (Re-verified attempt 3 after an earlier mid-session OpenAI
credits outage was resolved: 3/3 clean runs on the sacral note — exactly `64561`,
`64590`, `C1767`, no `C1778` — and the PNS note still correctly left its own generator
code blank with a clarification given its manufacturer ambiguity.)

## ICD-10 specificity comes from the diagnosis statement, not the procedure target

A coder's review of the PNS implant note's `G58.8`/`G57.81` flip-flopping (see the
non-determinism discussion in `lib/openai.ts`'s instructions above) resolved it with a
rule, not a code preference: she would code the more specific `G57.81` ("...of right
lower limb") **if the diagnosis/assessment statement itself named the nerve** — but
this note's Assessment line reads only `"Other specified mononeuropathies - G58.8"`,
with no nerve named there (the nerve — "right infrapatellar saphenous nerve" — is only
named in the Procedure section). Since the diagnosis statement itself doesn't specify
it, the generic `G58.8` is correct, even though the procedure target is specific.

This is a mechanically checkable rule — "does the diagnosis/assessment line itself
name the structure" — not an open-ended specificity judgment, which is exactly why it
fixed the flip-flopping: added to the `icd10Hint` bullet in `SYSTEM_INSTRUCTION`,
instructing the model to derive anatomic specificity only from the diagnosis
statement itself, never imported from the procedure description or elsewhere in the
note just because a structure is named there. Verified 4/4 consistent runs on the PNS
note post-fix (previously alternating roughly evenly between the two codes), with no
effect on the sacral note's diagnoses or either note's procedure codes.

Coding the generic form correctly doesn't mean the gap should go unmentioned, though —
whenever the diagnosis statement is less specific than a structure named elsewhere in
the note (this note's exact case), a `clarificationsNeeded` item is added noting the
mismatch and that a more specific code may be available if the provider
confirms/updates the diagnosis statement, so the coder can decide whether to query it.
Verified 3/3 runs: `G58.8` stayed stable and the mismatch was flagged every time, with
wording varying (e.g. "...while the procedure identifies the right infrapatellar
saphenous nerve...") but the substance consistent.

## Per-field Optum code search — real integration, live

When a diagnosis's ICD-10 code or a procedure's CPT/HCPCS code is left blank (per
"Codes are validated, not copied" above — the model wasn't confident enough to assign
one), `SummaryPanel.tsx` shows a "Search Optum" link right under that blank field.
Clicking it queries Optum's real **RealTime eContent** term-search API and renders the
results as a collapsible tree; clicking a leaf code fills the field (and adds/updates
the matching row in the Suggested Codes table, tagged `source: "Optum"`). This is a
**different, unrelated feature from the standalone "Look up a code" tool** in
`CodesTable.tsx`, see "Standalone Optum code lookup" below — don't conflate the two
(a third, the bulk "Get Codes via Optum" button, existed earlier and was removed, see
"What this app is" and "API routes" above).

The widget itself lives in its own file, `src/components/OptumCodeSearch.tsx` (it used
to be defined inline inside `SummaryPanel.tsx` — extracted so both this and the
standalone lookup below could share the recursive tree renderer without duplicating
it). It has an explicit "×" close button in the panel header, and also closes on
Escape or a click/tap outside it (`useEffect` + a `containerRef`, in
`OptumCodeSearch.tsx`) — an earlier version only had the toggle link itself to close
it, which wasn't discoverable once the panel covered it; don't remove all three ways
to close it again.

- **Auth**: `src/lib/optum.ts` exchanges `OPTUM_CLIENT_ID`/`OPTUM_CLIENT_SECRET` for a
  short-lived Bearer token via `client_credentials` grant against
  `https://apigw.optum.com/apip/auth/sntl/v1/token` (form-urlencoded POST). **These env
  vars hold the real OAuth client id/secret, NOT an access token** — an access token
  was mistakenly pasted into `OPTUM_CLIENT_SECRET` once during setup; it's a JWT with
  `iat`/`exp` ~2 hours apart and would silently stop working a couple hours later. If
  you ever see a JWT-looking value in `OPTUM_CLIENT_SECRET`, that's the same mistake —
  it needs the actual client secret instead.
- **Token caching**: the fetched token is cached in a module-level variable
  (`cachedToken` in `lib/optum.ts`) and reused until ~60s before its `expires_in`
  elapses, then refreshed automatically. This is in-memory only — reset on every cold
  start, not shared across instances. Fine at this app's scale; revisit with a shared
  cache (Redis, etc.) only if this is deployed multi-instance. `searchOptumCodes` also
  retries once on a `401` (clears the cache and re-fetches) in case a token was
  revoked/rejected early.
- **Search endpoint**: `GET https://realtimeecontent.com/ws/codetype/{codeType}/termsearchgroups/{term}`
  with `codeType` one of `"cpt" | "hcpcs" | "icd10cm"` (`OptumCodeType` in
  `types.ts` — deliberately lowercase/vendor-shaped, distinct from our own
  `CodeType`/`ProcedureCodeType`), query `data=rank,desc,desc-full&maxresults=50`. The
  response is a recursive tree (`OptumSearchNode`: `code`, `rank`, `desc`, `descFull`,
  `node: OptumSearchNode[]`) — a node with an empty `node` array is a real, selectable
  code; anything else is a grouping/range node (e.g. "K0001-K0195") that exists only to
  organize the tree and isn't itself selectable. `OptumResultNode` in the shared
  `src/components/OptumResultTree.tsx` renders this recursively, expanding/collapsing
  group nodes and treating leaves as clickable buttons — its `onSelect(code, desc)`
  passes back both the code and the leaf's own description, even though this per-field
  widget only uses `code` (it already knows its own field's description); the
  standalone lookup below needs `desc` too, which is why the shared renderer passes
  both.
- **UI wiring**: `DiagnosisEditor` searches `codeTypes={["icd10cm"]}` using
  `diagnosis.condition` as the term; `ProcedureEditor` searches
  `codeTypes={["cpt", "hcpcs"]}` (a small tab toggle lets the coder switch) using
  `procedure.description` as the term. The `OptumCodeSearch` widget only renders when
  the corresponding field is falsy — once a code is filled (by search or by typing),
  the widget disappears; clearing the field brings it back. The results panel is
  `absolute`-positioned as a floating overlay (not laid out inline) specifically
  because the code field's column is only `sm:w-32` — too narrow for a tree with
  descriptions; don't move it back into normal flow without solving that width problem
  again.
- **Populating both places at once**: selecting a leaf calls `onOptumSelect` (passed
  down per diagnosis/procedure from `SummaryPanel`), which does two things: updates
  `summary` (via the existing `onChange`) so the field shows the code, AND calls
  `onOptumCodeSelected` (a new `SummaryPanel` prop, wired to `handleOptumCodeSelected`
  in `page.tsx`) to upsert a row into the `codes` table by id (`ai-${diagnosis.id}` /
  `ai-${procedure.id}` — same id scheme `codesFromSummary` uses, so it's a true upsert,
  not a duplicate, if a row already exists for that id). Keep both halves in sync if
  you touch this path — filling only the summary field without updating the table
  would silently hide the new code from the actual coding deliverable.

## Standalone Optum code lookup — real integration, live

A third, independent way to get a code: `CodesTable.tsx` has a "Look up a code" button
(next to "Add missed code") that isn't tied to any specific diagnosis/procedure. The
coder types any term, picks a code type (**ICD-10 / CPT / HCPCS**, all three — unlike
the per-field search, which is scoped to the field it's attached to), and hits Search.
Selecting a leaf from the results tree **appends a new row straight to the Suggested
Codes table** (`source: "Optum"`) via `onAdd`/`handleAddFromOptum` in `page.tsx` — there
is no existing field to also fill, unlike the per-field version.

- Lives in `src/components/OptumLookup.tsx`, reusing the same shared
  `OptumResultNode` tree renderer as `OptumCodeSearch.tsx` (see
  `OptumResultTree.tsx`). The trigger is still a small button styled like
  `AddCodeRow`'s (dashed-border on mobile, text link on desktop), but the search
  UI itself opens in a **`Modal`** (`src/components/Modal.tsx`) rather than expanding
  inline — an inline panel kept pushing the whole Suggested Codes table down every
  time it opened or the tree grew, and a collapsible tree with descriptions needs
  real width/height to be readable, which a centered modal gives it (unlike the
  per-field search's cramped `sm:w-32` column, which is why that one instead floats
  as an `absolute` overlay — two different problems, two different fixes; don't
  conflate them or "fix" one using the other's approach).
- `Modal.tsx` is a generic, reusable shell (backdrop + centered dialog, portaled to
  `document.body` via `createPortal` so it always stacks above everything regardless
  of where it's rendered from): closes on Escape, on a backdrop click, or its own "×",
  locks background scroll while open, and focuses the dialog on open (`OptumLookup`
  additionally focuses its own search input via a `ref`). Reach for this instead of a
  one-off overlay if another feature needs a modal — don't build a second bespoke one.
- **Deliberately does not auto-close after adding a code** — unlike the per-field
  widget (which closes because it only has one slot to fill), this one stays open so
  the coder can search once and add several related codes in a row (e.g. searching
  "wheelchair" under HCPCS and adding more than one accessory code). It closes only via
  the modal's close mechanisms (its "×", Escape, or clicking the backdrop), which also
  resets the term/type/results back to defaults.
- Each `SuggestedCode` row it creates gets a fresh id off `optumCodeCounter` in
  `page.tsx` (`optum-${n}`) — a module-level counter, not per-render state, so ids
  stay unique across repeated additions.
- Selecting the same code twice appends two separate rows (no dedup) — same as the
  existing manual "Add missed code" behavior, so this isn't a new inconsistency.

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
- `SuggestedCode.source` is `'AI' | 'Optum' | 'Manual'`. `'AI'` rows come from
  `codesFromSummary`, populated automatically on analyze. `'Optum'` rows come from
  either live Optum feature — the per-field search (`handleOptumCodeSelected`) or the
  standalone lookup (`handleAddFromOptum`) — see those sections below; there used to
  be a third source, the bulk "Get Codes via Optum" button, but it was removed (see
  "API routes" above) since it never got past a `501` stub. `'Manual'` is a
  coder-typed addition (via `AddCodeRow`/`handleAddManual`); there's no default status
  attached to it — see "Reference-only tool" above, there is no `CodeStatus` concept
  anymore.
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
