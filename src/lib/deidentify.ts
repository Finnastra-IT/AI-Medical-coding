// Dependency-free, client-safe de-identification of a pasted/imported SOAP
// note, run BEFORE the note is allowed anywhere near /api/analyze. See
// AGENTS.md "SOAP note de-identification" for the full design and its
// limitations — this is a best-effort scrub combining a few independent
// strategies (see below), NOT a guarantee of catching every possible
// identifier in free text. The cleaned result must still be reviewed by a
// person before analysis — this function does not, and cannot, replace
// that review.
//
// History (read this before changing the strategy again):
// - v1 only recognized clean single-line "Label: value" pairs against an
//   exact label list. A real EHR-exported header broke every one of those
//   assumptions at once (name embedded in running text with no label,
//   "Label value" with no colon, label wording that didn't exactly match) —
//   every field silently slipped through.
// - v2 added format-based detectors (name shape, DOB, ID, SSN, phone,
//   email) plus a keyword-contains label scanner, and replaced matched
//   VALUES in place, broadcasting every match across the whole document.
//   That broadcast was itself a bug: a pharmacy address like "ALEXANDRIA,
//   VA" has the exact same "ALLCAPS, Word" shape as a patient's "SURNAME,
//   First" name, so it false-positive-matched the name pattern — and
//   because every match was replaced *everywhere in the document*, the
//   unrelated "VA" in the clinic's own address at the top got wiped too.
// - v3 stopped trying to surgically redact values inside
//   administrative/demographic content and instead drops that content
//   *wholesale*: none of a scheduling header, insurance block, care-team
//   roster, or pharmacy list is needed for coding, so there's no reason to
//   keep fighting to redact individual values inside it. Only content that
//   looks genuinely clinical gets kept. Initially only a confirmed patient
//   *name* (extracted from the dropped header) was broadcast-replaced across
//   the remaining clinical content, on the theory that everything else was
//   handled locally and didn't need it — but that missed a repeat mention of
//   e.g. the header's MRN or policy number showing up again in the body in a
//   form no per-line detector recognized (no "mrn"/"id#" keyword next to it,
//   just the bare number). v3.1 stores *every* identifier extracted from the
//   header — not just the name — and broadcasts all of them the same way.
//   This is still safe against the v2 broadcast bug because the *source* is
//   bounded to the header region specifically (known-administrative, already
//   about to be dropped entirely), not the whole document — unlike v2, which
//   scanned everywhere for name-shaped text and broadcast whatever it found,
//   including false positives.
// - v3.2 fixed two more gaps a real multi-page EHR export exposed:
//   1. A clinic letterhead/address line ("Privia - KOHU - Alexandria Medical
//      Associates • 6355 Walker Lane, ALEXANDRIA VA 22310-3247") repeats as a
//      running page header throughout the document, not just once before the
//      clinical marker — so treating it as header-only content missed every
//      recurrence past the first page. Fixed with a new whole-line drop,
//      STREET_ADDRESS_LINE, checked position-independently like NPI_LINE/
//      FAX_LINE — a "<number> <street>, <CITY> <ST> <ZIP>" shape only ever
//      appears in a letterhead/mailing address, never clinical narrative,
//      and is generic (not tied to any one clinic's actual name/address).
//   2. Provider names in a closing "Return to Office" / "Encounter Sign-Off"
//      block (follow-up scheduling, attestation) were never caught at all,
//      because NAME_PATTERN deliberately only runs on the header (see the
//      COPD/Exacerbation note below) and this block sits well past it, in the
//      clinical body. That whole block has zero coding value anyway, so it's
//      dropped wholesale — FOOTER_MARKER finds the first "Return to Office"/
//      "Encounter Sign-Off" line and everything from there to the end of the
//      note is removed, the same way the pre-clinical header is removed,
//      rather than trying to teach NAME_PATTERN to also recognize provider
//      names safely in body text.
// - v3.3 (current): the same repeating per-page banner that motivated
//   STREET_ADDRESS_LINE above also carries the patient's own name/id/dob
//   ("NAME (id #12345678, dob: 01/02/1980)") on every page — and a surname
//   written in a form NAME_PATTERN's tokenizer didn't fully capture on one
//   real export left a partial "[PATIENT] SURNAME (id #[PATIENT], dob:
//   [PATIENT])" fragment behind instead of a clean removal. Rather than
//   chasing every name-formatting variant the tokenizer might miss, this
//   banner gets the same treatment as the letterhead line: PATIENT_BANNER_LINE
//   matches the "(id #..., dob: .../.../...)" signature — a shape that only
//   ever appears in this exact demographic banner — and drops the whole line,
//   whatever name precedes it, wherever it recurs. This is a deliberate
//   product choice (see history above): remove the banner entirely rather
//   than depend on correctly redacting a name inside it every time.
// - v4 (current) fixed a much bigger problem than any single missed identifier:
//   on a real ~12,500-word visit summary, Clean Note collapsed it to ~2,500
//   words, silently deleting Vitals, Allergies, Medications, Vaccines,
//   Problems, Family History, Social History, Surgical History, GYN History,
//   Obstetric History, and Past Medical History — all of it genuine,
//   coding-relevant documentation, not administrative noise. The cause:
//   CLINICAL_CONTENT_MARKER only recognized narrative SOAP/HPI-style section
//   names as "real clinical content starts here," so on a note whose layout
//   puts a full chart review (vitals/meds/allergies/problem list/history)
//   *before* the HPI narrative, ALL of that got treated as pre-clinical
//   "header" and dropped wholesale right along with the actual demographic
//   banner. Renamed to CHART_CONTENT_MARKER and broadened to also recognize
//   these standard EHR review-section headers, so the header-to-drop region
//   is narrowed back down to whatever genuinely comes before the first real
//   documentation section (typically just a short letterhead/demographic
//   banner, if the export even has one) rather than everything before the
//   narrative portion specifically. The same real note also reproduced the
//   v2 "VA" bug in a new spot: the header's letterhead/address line, left
//   unfiltered in `headerLines`, let NAME_PATTERN pull "ALLCAPS, Word"-shaped
//   false identifiers out of the clinic's own address, which v3.1's broadcast
//   then replaced everywhere — corrupting the clinical abbreviation "US"
//   (ultrasound) and the pharmacy name "WEGMANS ALEXANDRIA PHARMACY". Fixed
//   by filtering the whole-line-drop shapes (address/NPI/fax/phone/section-
//   title/prescription-eligibility) out of headerLines *before* running
//   collectIdentifiers on it, so NAME_PATTERN never sees that text at all.
// - v4.1 (current): verifying v4 against another real note ("(703) 922-0264"
//   sitting on its own line right under Chief Complaint) surfaced a
//   pre-existing, unrelated bug: PHONE_PATTERN's shared leading `\b` was
//   placed before an alternation whose first branch starts with "(" — but
//   `\b` only matches at a word/non-word transition, and "(" is non-word on
//   both sides when preceded by whitespace or line-start (the normal case).
//   That silently made the parenthesized-format branch, `(XXX) XXX-XXXX` —
//   the single most common US phone format — never match at all, in any
//   context, since this pattern was added back in v2. Fixed by giving each
//   alternative its own anchor instead of one shared leading `\b`. The same
//   root cause turned out to also break *redaction* once detection was
//   fixed: the per-line and broadcast replace steps each rebuild a fresh
//   `\b${escapeRegExp(value)}\b` from the raw matched string, which hits the
//   identical failure whenever that string itself starts or ends with a
//   non-word character (still true of a parenthesized phone number) — so a
//   line with other real content around the phone number detected it but
//   then silently failed to redact it. Fixed with `toBoundaryPattern`, which
//   only adds `\b` at an edge whose own character is a word character.

const CHART_CONTENT_MARKER =
  /^\s*(subjective|objective|assessment|plan|chief complaint|history of present illness|hpi|reason for visit|review of systems|ros|physical exam|vitals|measurements|allergies|medications|vaccines|problems|family history|social history|surgical (?:&|and) procedure history|past medical history|gyn history|obstetric history|screening)\b|^\s*[soap]\s*[:\-]/i;

// Whole-line drops, checked independently of position — these shapes only
// ever appear in administrative/contact content in practice, never in
// clinical narrative.
const SECTION_TITLE_LINE = /^\s*patient'?s?\s+(care team|pharmacies)\s*\*?\s*$/i;
const PRESCRIPTION_ELIGIBILITY_LINE = /^\s*prescription\s*:.*\beligib/i;
const NPI_LINE = /\bNPI\s*:?\s*\d{6,}\b/i;
const FAX_LINE = /\bFax\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i;
const PROVIDER_PHONE_LINE = /\bPh\s*\(\d{3}\)/i;
// A full mailing address ("6355 Walker Lane, ALEXANDRIA VA 22310-3247") only
// ever shows up in a clinic's own letterhead/contact block — including as a
// running page header repeated throughout a multi-page export — never in
// clinical narrative, so it's safe to drop the whole line wherever it recurs.
// Shape-based, not tied to any specific clinic's name/address.
const STREET_ADDRESS_LINE =
  /\b\d{1,6}\s+[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}\s*,\s*[A-Za-z][A-Za-z\s]*[A-Za-z]\s+[A-Z]{2}\s+\d{5}(-\d{4})?\b/;

// A repeating per-page patient banner ("NAME (id #12345678, dob: 01/02/1980)")
// — the "(id #..., dob: .../.../...)" signature only ever appears in this
// exact demographic-banner shape, never in clinical narrative, so the whole
// line is dropped outright rather than relying on NAME_PATTERN to correctly
// tokenize and broadcast-replace whatever name precedes it. This is a
// deliberately stronger fix than patching the name-token extraction: the
// product call here (see history above) is to remove this banner entirely
// wherever it recurs, not leave a partially-redacted "[PATIENT] SURNAME
// (id #[PATIENT], dob: [PATIENT])" fragment behind.
const PATIENT_BANNER_LINE =
  /\(id\s*#\s*[\w-]+\s*,\s*dob\s*:?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\)/i;

// Marks the start of a closing administrative block (follow-up scheduling,
// sign-off attestation) that sometimes trails the actual clinical content —
// none of it has coding value, and it's where a provider's name tends to
// recur in a form NAME_PATTERN never sees (see the history comment above for
// why that pattern is deliberately scoped to the header only). Everything
// from the first matching line to the end of the note is dropped wholesale,
// the same way the pre-clinical header is. Matches the phrase generically,
// not tied to any specific provider's name.
const FOOTER_MARKER =
  /^\s*(return to (the )?office|encounter sign[\s-]?off)\s*$/i;

// Labels that must match a line's text EXACTLY (after trim/lowercase) — too
// generic to safely match as a substring of an arbitrary label (e.g. "name"
// would also match "Drug Name:", "patient" would match "Patient Education:").
const EXACT_PHI_LABELS = new Set(["name", "patient", "patient name"]);

// Labels matched by substring-contains — safe to be broader here since these
// phrases essentially never appear as part of an unrelated clinical label.
const PHI_LABEL_KEYWORDS = [
  "dob",
  "date of birth",
  "mrn",
  "medical record",
  "ssn",
  "social security",
  "insurance",
  "policy",
  "group #",
  "member id",
  "account #",
  "account number",
  "guarantor",
  "emergency contact",
  "address",
  "phone",
  "telephone",
  "email",
];

// Labels whose VALUE is itself a person's name — worth also splitting into
// individual tokens so a lone later "Jane" or "Roe" is caught too. Other
// labels (address, insurance, account #, ...) are stored as a whole value
// only — tokenizing e.g. "42 Ocean Ave" would add "42" as a standalone
// identifier and could blow away an unrelated vital sign or dose elsewhere.
const NAME_VALUE_LABELS = new Set([
  "name",
  "patient",
  "patient name",
  "guarantor",
  "emergency contact",
]);

const LABELED_LINE = /^\s*([A-Za-z][A-Za-z \/#]{1,40}?)\s*[:\-]\s*(.+?)\s*$/;

// "SURNAME, First [Middle]" — the all-caps-surname convention is
// characteristic of EHR patient/appointment banners. Only used to pull the
// CONFIRMED patient name out of the header (see above for why other matches
// of this shape — e.g. a city/state pair, a provider byline — are handled
// per-line instead of being trusted as a name and broadcast everywhere).
const NAME_PATTERN =
  /\b([A-Z]{2,}),\s*([A-Z][A-Za-z'-]{1,30})(?:\s+([A-Z][A-Za-z'-]{1,30}))?\b/g;

// Format-specific values. Matched per-line only (see history above) — a
// match is either replaced in place on its own line, or the whole line is
// dropped if nothing substantial is left once it's removed (see
// lineHasSubstantialContent).
const DOB_PATTERN =
  /\b(?:dob|date of birth)\s*[:#]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
const ID_PATTERN = /\b(?:id\s*#|mrn\s*#?)\s*:?\s*(\d{4,})/gi;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
// Two alternatives with separate leading anchors, not one shared leading \b:
// \b can never match immediately before "(" when it's preceded by whitespace
// or line-start (both sides of that position are non-word), so a shared
// `\b(?:\(\d{3}\)|\d{3})...` silently never matches the parenthesized branch
// at all — see the v4.1 history note above for the real leak this caused.
const PHONE_PATTERN =
  /\(\d{3}\)\s?\d{3}[-.\s]\d{4}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

// Words/punctuation that don't count as "substantial content" when deciding
// whether a line is worth keeping after its identifying values are removed —
// mostly the label/filler words that surround those values in a banner.
const BOILERPLATE_WORDS = new Set([
  "name",
  "patient",
  "id",
  "dob",
  "mrn",
  "provider",
  "insurance",
  "policy",
  "group",
  "account",
  "guarantor",
  "emergency",
  "contact",
  "ph",
  "fax",
  "npi",
  "office",
  "primary",
  "care",
  "team",
  "pharmacy",
  "pharmacies",
  "member",
  "prescription",
  "service",
  "dept",
  "appt",
  "date",
  "time",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A plain `\b${escapeRegExp(value)}\b` silently fails to match whenever value
// starts or ends with a non-word character (e.g. "(703) 922-0264" — see the
// v4.1 history note above): \b only holds at a word/non-word transition, and
// a leading/trailing "(" preceded/followed by whitespace is non-word on both
// sides. Only add \b at an edge where the value's own character is a word
// character — the other edges don't need one, since adjacent non-word/
// whitespace already can't run together with real content.
function toBoundaryPattern(value: string): string {
  const escaped = escapeRegExp(value);
  const leading = /\w/.test(value[0]) ? "\\b" : "";
  const trailing = /\w/.test(value[value.length - 1]) ? "\\b" : "";
  return `${leading}${escaped}${trailing}`;
}

function collectMatches(
  text: string,
  pattern: RegExp,
  groupIndex: number
): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[groupIndex];
    if (value) values.push(value);
  }
  return values;
}

// After stripping matched identifier spans and known boilerplate/punctuation
// from a line, is there anything left worth keeping? Requires at least one
// alphabetic word of 3+ letters that isn't in BOILERPLATE_WORDS.
function lineHasSubstantialContent(residual: string): boolean {
  const words = residual.match(/[A-Za-z]{3,}/g) ?? [];
  return words.some((word) => !BOILERPLATE_WORDS.has(word.toLowerCase()));
}

// Extracts every identifying value found across a set of lines — name-shaped
// values, DOB/ID/SSN/phone/email shapes, and PHI-labeled "Label: value"
// pairs. Used on the header lines specifically (see history above) so the
// result can be stored and compared against the rest of the note, catching
// a repeat mention that no per-line detector would recognize on its own
// (e.g. a bare MRN number with no "id#"/"mrn" keyword next to it).
function collectIdentifiers(scopeLines: string[]): Set<string> {
  const identifiers = new Set<string>();

  const addValue = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length >= 2) identifiers.add(trimmed);
  };

  const addNameValue = (value: string) => {
    addValue(value);
    for (const rawToken of value.split(/\s+/)) {
      // Strip trailing punctuation ("MARF," -> "MARF") — a token ending in a
      // non-word character otherwise can't satisfy a trailing \b boundary
      // when followed by whitespace/punctuation, making it a silent no-op.
      const token = rawToken.replace(/[,.;:]+$/, "");
      if (token.length >= 2) identifiers.add(token);
    }
  };

  for (const line of scopeLines) {
    for (const match of line.matchAll(NAME_PATTERN)) addNameValue(match[0]);
    for (const value of collectMatches(line, DOB_PATTERN, 1)) addValue(value);
    for (const value of collectMatches(line, ID_PATTERN, 1)) addValue(value);
    for (const value of collectMatches(line, SSN_PATTERN, 0)) addValue(value);
    for (const value of collectMatches(line, PHONE_PATTERN, 0)) addValue(value);
    for (const value of collectMatches(line, EMAIL_PATTERN, 0)) addValue(value);

    const labeled = line.match(LABELED_LINE);
    if (!labeled) continue;
    const label = labeled[1].trim().toLowerCase();
    const isPhiLabel =
      EXACT_PHI_LABELS.has(label) ||
      PHI_LABEL_KEYWORDS.some((keyword) => label.includes(keyword));
    if (!isPhiLabel) continue;

    if (NAME_VALUE_LABELS.has(label)) {
      addNameValue(labeled[2]);
    } else {
      addValue(labeled[2]);
    }
  }

  return identifiers;
}

export interface DeidentifyResult {
  cleaned: string;
  /** Number of distinct identifying values found (name, DOB, MRN, etc). */
  identifiersFound: number;
  /** Number of occurrences of those values replaced/removed across the note. */
  mentionsRedacted: number;
}

export function deidentifySoapNote(rawText: string): DeidentifyResult {
  const lines = rawText.split(/\r?\n/);

  // Where does genuine chart documentation start? If found, everything
  // before it is a scheduling/demographic header with zero coding value —
  // drop it wholesale rather than trying to redact values inside it. This
  // boundary intentionally recognizes standard EHR review sections (Vitals,
  // Medications, Problems, ...) as much as narrative SOAP/HPI markers — see
  // the v4 history note above for why treating only the narrative sections as
  // "real" content once deleted an entire chart review by mistake. If nothing
  // is found, we can't safely assume a boundary — process the whole note
  // per-line instead of risking deleting the entire actual note.
  const clinicalStartLine = lines.findIndex((line) =>
    CHART_CONTENT_MARKER.test(line)
  );
  const headerLines =
    clinicalStartLine === -1 ? [] : lines.slice(0, clinicalStartLine);
  const restLines =
    clinicalStartLine === -1 ? lines : lines.slice(clinicalStartLine);

  // Strip known administrative/letterhead shapes out of the header BEFORE
  // extracting identifiers from it — otherwise NAME_PATTERN's "ALLCAPS,
  // Word" scan can pull a false "identifier" straight out of the clinic's
  // own address line (the v2 "VA" bug resurfacing here, see the v4 history
  // note above), and v3.1's broadcast then replaces that false match
  // everywhere, corrupting unrelated clinical text.
  const headerLinesForIdentifiers = headerLines.filter(
    (line) =>
      !STREET_ADDRESS_LINE.test(line) &&
      !NPI_LINE.test(line) &&
      !FAX_LINE.test(line) &&
      !PROVIDER_PHONE_LINE.test(line) &&
      !SECTION_TITLE_LINE.test(line) &&
      !PRESCRIPTION_ELIGIBILITY_LINE.test(line)
  );

  // Everything worth carrying forward from the dropped header: not just the
  // patient's name, but every identifier found there (DOB, MRN, policy
  // number, phone, ...) — stored so a repeat mention elsewhere in the note
  // can still be caught even if it appears in a form no per-line detector
  // below would recognize on its own (e.g. a bare MRN number with no
  // "id#"/"mrn" keyword next to it the second time). Nothing else from the
  // header is kept.
  const confirmedIdentifiers = collectIdentifiers(headerLinesForIdentifiers);

  // A closing administrative block (follow-up scheduling, sign-off
  // attestation) sometimes trails the clinical content — see FOOTER_MARKER's
  // comment above for why it's dropped wholesale rather than scrubbed
  // per-line. Same safe-fallback rule as the header: if no such line is
  // found, nothing is dropped rather than risking the end of a genuine note.
  const footerStartLine = restLines.findIndex((line) =>
    FOOTER_MARKER.test(line)
  );
  const clinicalLines =
    footerStartLine === -1 ? restLines : restLines.slice(0, footerStartLine);
  const footerLines =
    footerStartLine === -1 ? [] : restLines.slice(footerStartLine);

  let identifiersFound = confirmedIdentifiers.size;
  // one "mention" per dropped header/footer line
  let mentionsRedacted = headerLines.length + footerLines.length;

  const keptLines: string[] = [];

  for (const line of clinicalLines) {
    if (
      SECTION_TITLE_LINE.test(line) ||
      PRESCRIPTION_ELIGIBILITY_LINE.test(line) ||
      NPI_LINE.test(line) ||
      FAX_LINE.test(line) ||
      PROVIDER_PHONE_LINE.test(line) ||
      STREET_ADDRESS_LINE.test(line) ||
      PATIENT_BANNER_LINE.test(line)
    ) {
      identifiersFound += 1;
      mentionsRedacted += 1;
      continue; // drop whole line — administrative/contact content only
    }

    // Collect this line's own identifier matches (never broadcast beyond
    // this line — see the history note above for why). Deliberately does
    // NOT re-run NAME_PATTERN here: this is clinical narrative at this
    // point (the header was already dropped wholesale above), and that
    // pattern's "ALLCAPS, Word" shape can false-positive on a real clinical
    // term (e.g. "COPD, Exacerbation") — it stays scoped to the header,
    // where it's used only to identify the confirmed patient name.
    const lineValues = new Set<string>();
    for (const value of collectMatches(line, DOB_PATTERN, 1)) lineValues.add(value);
    for (const value of collectMatches(line, ID_PATTERN, 1)) lineValues.add(value);
    for (const value of collectMatches(line, SSN_PATTERN, 0)) lineValues.add(value);
    for (const value of collectMatches(line, PHONE_PATTERN, 0)) lineValues.add(value);
    for (const value of collectMatches(line, EMAIL_PATTERN, 0)) lineValues.add(value);

    const labeled = line.match(LABELED_LINE);
    let labelValue: string | null = null;
    if (labeled) {
      const label = labeled[1].trim().toLowerCase();
      const isPhiLabel =
        EXACT_PHI_LABELS.has(label) ||
        PHI_LABEL_KEYWORDS.some((keyword) => label.includes(keyword));
      if (isPhiLabel) {
        labelValue = labeled[2];
        lineValues.add(labelValue);
      }
    }

    if (lineValues.size === 0) {
      keptLines.push(line);
      continue;
    }

    identifiersFound += lineValues.size;

    let residual = line;
    for (const value of [...lineValues].sort((a, b) => b.length - a.length)) {
      residual = residual.replace(
        new RegExp(escapeRegExp(value), "gi"),
        " "
      );
    }

    if (!lineHasSubstantialContent(residual)) {
      mentionsRedacted += 1;
      continue; // drop whole line — it was nothing but identifying values
    }

    let redactedLine = line;
    for (const value of [...lineValues].sort((a, b) => b.length - a.length)) {
      const pattern = new RegExp(toBoundaryPattern(value), "gi");
      redactedLine = redactedLine.replace(pattern, () => {
        mentionsRedacted += 1;
        return "[PATIENT]";
      });
    }
    keptLines.push(redactedLine);
  }

  let cleaned = keptLines.join("\n");

  // Broadcast every confirmed header identifier across whatever clinical
  // content survived, longest value first so e.g. a full name is replaced
  // before its individual tokens would be. Safe to broadcast (unlike v2,
  // see history above) because the source is bounded to the header region
  // specifically, not a name-shaped match found anywhere in the document.
  const sortedIdentifiers = [...confirmedIdentifiers].sort(
    (a, b) => b.length - a.length
  );
  for (const identifier of sortedIdentifiers) {
    const pattern = new RegExp(toBoundaryPattern(identifier), "gi");
    cleaned = cleaned.replace(pattern, () => {
      mentionsRedacted += 1;
      return "[PATIENT]";
    });
  }

  return {
    cleaned: cleaned.trim(),
    identifiersFound,
    mentionsRedacted,
  };
}
