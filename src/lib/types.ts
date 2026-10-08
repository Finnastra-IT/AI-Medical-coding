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

// The Optum RealTime eContent term-search API's own casing/vocabulary for a
// code family — deliberately kept distinct from CodeType/ProcedureCodeType
// (which use "ICD-10"/"E/M" etc.) since this is what the wire API expects in
// its URL path, not our internal domain vocabulary.
export type OptumCodeType = "cpt" | "hcpcs" | "icd10cm";

// A node in the term-search response tree. Leaf nodes (an actual selectable
// code) have an empty `node` array; anything else is a grouping/range node
// (e.g. "K0001-K0195") that exists purely to organize the tree.
export interface OptumSearchNode {
  code: string;
  rank: number;
  desc: string;
  descFull: string;
  node: OptumSearchNode[];
}

export interface OptumSearchRequest {
  term: string;
  codeType: OptumCodeType;
}

export type UserRole = "admin" | "user";

// The authenticated user shape exposed to the client (e.g. via the session
// endpoint and the admin user-management table) — never includes
// `passwordHash`, which only ever exists in `lib/auth.ts`/the database row.
export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  role?: UserRole;
  isActive?: boolean;
  /** Only present when the admin is resetting this user's password. */
  password?: string;
}
