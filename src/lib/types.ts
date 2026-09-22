export interface Encounter {
  type: string;
  date?: string;
  provider?: string;
}

export interface DiagnosisAttribute {
  label: string;
  value: string;
}

export interface Diagnosis {
  id: string;
  condition: string;
  icd10Hint?: string;
  attributes: DiagnosisAttribute[];
}

export type ProcedureCodeType = "CPT" | "HCPCS" | "E/M";

export interface Procedure {
  id: string;
  description: string;
  cptHint?: string;
  /** Which code family `cptHint` belongs to. Absent is treated as "CPT". */
  codeType?: ProcedureCodeType;
  /** e.g. "25", "59", "RT" — only present when the note supports one. */
  modifier?: string;
  /** Quantity billed. Absent/1 means "not worth showing", not "zero". */
  units?: number;
}

export interface Negation {
  id: string;
  text: string;
}

export interface ClinicalSummary {
  encounter: Encounter;
  briefSummary: string;
  diagnoses: Diagnosis[];
  procedures: Procedure[];
  negations: Negation[];
  clarificationsNeeded: string[];
}

export type CodeType = "ICD-10" | "CPT" | "HCPCS" | "E/M";

export type CodeSource = "AI" | "Optum" | "Manual";

export interface SuggestedCode {
  id: string;
  code: string;
  description: string;
  type: CodeType;
  source: CodeSource;
  /** e.g. "25", "59", "RT" — only present when applicable. */
  modifier?: string;
  /** Quantity billed. Absent/1 means "not worth showing", not "zero". */
  units?: number;
}

export interface AnalyzeRequest {
  soapNote: string;
}

export interface GenerateCodesRequest {
  summary: ClinicalSummary;
}
