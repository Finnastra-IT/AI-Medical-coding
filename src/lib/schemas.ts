import { z } from "zod";

export const analyzeRequestSchema = z.object({
  soapNote: z.string().trim().min(1, "soapNote must not be empty"),
});

const diagnosisAttributeSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const diagnosisSchema = z.object({
  id: z.string(),
  condition: z.string(),
  icd10Hint: z.string().optional(),
  attributes: z.array(diagnosisAttributeSchema),
});

const procedureSchema = z.object({
  id: z.string(),
  description: z.string(),
  cptHint: z.string().optional(),
  codeType: z.enum(["CPT", "HCPCS", "E/M"]).optional(),
  modifier: z.string().optional(),
  units: z.number().optional(),
});

const negationSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const clinicalSummarySchema = z.object({
  encounter: z.object({
    type: z.string(),
    date: z.string().optional(),
    provider: z.string().optional(),
  }),
  briefSummary: z.string(),
  diagnoses: z.array(diagnosisSchema),
  procedures: z.array(procedureSchema),
  negations: z.array(negationSchema),
  clarificationsNeeded: z.array(z.string()),
});

export const generateCodesRequestSchema = z.object({
  summary: clinicalSummarySchema,
});
