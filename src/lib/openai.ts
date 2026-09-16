import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { clinicalSummarySchema } from "./schemas";
import type { ClinicalSummary } from "./types";

// OpenAI's Structured Outputs (strict mode) require every object property to
// be listed in "required" — a field that's genuinely optional in our domain
// model (types.ts) must instead be typed as nullable so the model can send
// `null`. This schema exists only to talk to the API; responses are
// normalized back to the app's canonical optional-field shape below, and
// re-validated against `clinicalSummarySchema` before use.
const openAiClinicalSummarySchema = z.object({
  encounter: z.object({
    type: z.string(),
    date: z.string().nullable(),
    provider: z.string().nullable(),
  }),
  briefSummary: z.string(),
  diagnoses: z.array(
    z.object({
      id: z.string(),
      condition: z.string(),
      attributes: z.array(z.object({ label: z.string(), value: z.string() })),
    })
  ),
  procedures: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
    })
  ),
  negations: z.array(z.object({ id: z.string(), text: z.string() })),
  clarificationsNeeded: z.array(z.string()),
});

// "mini" tier: fast/cheap enough for an interactive click-to-analyze flow,
// while still supporting strict structured JSON output. Override with
// OPENAI_MODEL for a higher-accuracy tier (e.g. a "-pro" model) if needed.
const DEFAULT_MODEL = "gpt-5.4-mini";

const SYSTEM_INSTRUCTION = `You are an experienced medical coder reviewing a SOAP
note yourself, the way you would during chart review before assigning codes. Read
the note and produce a structured analysis as JSON matching the provided schema:

- "encounter": the encounter type, and date/provider only as a role or department
  (e.g. "Cardiology", "Attending Physician") — never as a person's name.
- "briefSummary": a concise, analyzed summary in your own words as the coder — not
  a restatement or copy of the note's sentences. Synthesize what clinically
  happened and why it matters for coding (the key problem(s), relevant findings,
  and the plan), in 1-3 sentences.
- "diagnoses": each distinct diagnosis, with a short unique "id" (e.g. "dx-1") and
  any explicit attributes (status, severity, laterality, relevant values) as
  label/value pairs. Do not include a code or code hint here — coding is handled
  by a separate system later; your job right now is clinical analysis only.
- "procedures": each procedure performed or ordered, with a short unique "id"
  (e.g. "px-1"). Same rule: describe it, don't code it.
- "negations": things the note explicitly says did NOT occur or were denied (e.g.
  "denies chest pain"), each with a short unique "id" (e.g. "neg-1"). Diagnostic
  uncertainty (an unconfirmed or differential diagnosis) is NOT a negation — that
  belongs in "clarificationsNeeded" instead, see below.
- "clarificationsNeeded": only after you've done your full analysis, if — and only
  if — you genuinely cannot reach a confident conclusion on something a coder
  would need, state plainly what should be asked of (or confirmed by) the
  provider to resolve it. This includes: the note is silent on laterality/severity
  where it matters, the encounter type is unclear, OR the note itself leaves a
  diagnosis unconfirmed/differential (e.g. "gout vs. cellulitis", "possible
  pneumonia, r/o other causes") — marking such a diagnosis's status as
  "suspected"/"differential" in its attributes is not a substitute for flagging it
  here, since the coder cannot finalize a code from an unconfirmed diagnosis
  without knowing that. Do not add an item for minor phrasing ambiguity or
  something you can reasonably infer — this list is for real gaps, not hedging.
  Still give your best-effort analysis for every other field regardless of any
  gap you flag here. Return an empty array when nothing is genuinely unresolved.

Never include any person's name (patient, family member, or provider) anywhere in
the output, even if one appears in the note — refer to people by role instead
(e.g. "the patient", "the attending"). Only include what is stated or clearly
implied in the note.`;

export async function analyzeWithOpenAI(
  soapNote: string
): Promise<ClinicalSummary> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    instructions: SYSTEM_INSTRUCTION,
    input: soapNote,
    temperature: 0.2,
    text: {
      format: zodTextFormat(openAiClinicalSummarySchema, "clinical_summary"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned a response that could not be parsed");
  }

  const raw = response.output_parsed;
  const normalized: ClinicalSummary = {
    encounter: {
      type: raw.encounter.type,
      date: raw.encounter.date ?? undefined,
      provider: raw.encounter.provider ?? undefined,
    },
    briefSummary: raw.briefSummary,
    diagnoses: raw.diagnoses,
    procedures: raw.procedures,
    negations: raw.negations,
    clarificationsNeeded: raw.clarificationsNeeded,
  };

  const result = clinicalSummarySchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(
      `OpenAI response did not match the expected summary shape: ${result.error.issues[0]?.message}`
    );
  }

  return result.data;
}
