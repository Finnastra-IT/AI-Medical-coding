import axios from "axios";
import type {
  AnalyzeRequest,
  ClinicalSummary,
  OptumCodeType,
  OptumSearchNode,
  OptumSearchRequest,
} from "./types";

export async function analyzeNote(soapNote: string): Promise<ClinicalSummary> {
  const payload: AnalyzeRequest = { soapNote };
  const { data } = await axios.post<ClinicalSummary>("/api/analyze", payload);
  return data;
}

export async function searchOptumCodes(
  term: string,
  codeType: OptumCodeType
): Promise<OptumSearchNode[]> {
  const payload: OptumSearchRequest = { term, codeType };
  const { data } = await axios.post<{ results: OptumSearchNode[] }>(
    "/api/optum-search",
    payload
  );
  return data.results;
}

// .txt is read directly in the browser (file.text()), never uploaded — only
// .docx/.pdf need server-side parsing (mammoth/pdf-parse). See
// api/import-note/route.ts and AGENTS.md "SOAP note de-identification".
export const SUPPORTED_IMPORT_EXTENSIONS = [".txt", ".docx", ".pdf"] as const;

export async function importNoteFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) {
    return file.text();
  }

  const formData = new FormData();
  formData.append("file", file);
  const { data } = await axios.post<{ text: string }>(
    "/api/import-note",
    formData
  );
  return data.text;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
