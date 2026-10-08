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

export const optumSearchRequestSchema = z.object({
  term: z.string().trim().min(1, "term must not be empty"),
  codeType: z.enum(["cpt", "hcpcs", "icd10cm"]),
});

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, "username must not be empty"),
  password: z.string().min(1, "password must not be empty"),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, "username must be at least 3 characters")
  .max(50, "username must be at most 50 characters")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "username may only contain letters, numbers, '.', '_', and '-'"
  );

const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters");

export const createUserRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "user"]),
});

export const updateUserRequestSchema = z
  .object({
    role: z.enum(["admin", "user"]).optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.isActive !== undefined ||
      data.password !== undefined,
    { message: "at least one of role, isActive, or password must be provided" }
  );
