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

export interface Procedure {
  id: string;
  description: string;
  cptHint?: string;
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

export type CodeType = "ICD-10" | "CPT";

export type CodeSource = "AI" | "Optum" | "Manual";

export type CodeStatus = "accepted" | "rejected" | "modified" | "pending";

export interface SuggestedCode {
  id: string;
  code: string;
  description: string;
  type: CodeType;
  source: CodeSource;
  status: CodeStatus;
}

export interface AnalyzeRequest {
  soapNote: string;
}

export interface GenerateCodesRequest {
  summary: ClinicalSummary;
}
