import axios from "axios";
import type {
  AnalyzeRequest,
  ClinicalSummary,
  GenerateCodesRequest,
  OptumCodeType,
  OptumSearchNode,
  OptumSearchRequest,
  SuggestedCode,
} from "./types";

export async function analyzeNote(soapNote: string): Promise<ClinicalSummary> {
  const payload: AnalyzeRequest = { soapNote };
  const { data } = await axios.post<ClinicalSummary>("/api/analyze", payload);
  return data;
}

export async function generateCodes(
  summary: ClinicalSummary
): Promise<SuggestedCode[]> {
  const payload: GenerateCodesRequest = { summary };
  const { data } = await axios.post<SuggestedCode[]>(
    "/api/generate-codes",
    payload
  );
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

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
