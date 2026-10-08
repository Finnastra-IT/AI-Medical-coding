import axios from "axios";
import type {
  AnalyzeRequest,
  AppUser,
  ClinicalSummary,
  CreateUserRequest,
  LoginRequest,
  OptumCodeType,
  OptumSearchNode,
  OptumSearchRequest,
  UpdateUserRequest,
} from "./types";

export async function analyzeNote(soapNote: string): Promise<ClinicalSummary> {
  const payload: AnalyzeRequest = { soapNote };
  const { data } = await axios.post<ClinicalSummary>("/api/analyze", payload);
  return data;
}

export async function login(username: string, password: string): Promise<AppUser> {
  const payload: LoginRequest = { username, password };
  const { data } = await axios.post<{ user: AppUser }>("/api/auth/login", payload);
  return data.user;
}

export async function logout(): Promise<void> {
  await axios.post("/api/auth/logout");
}

export async function listUsers(): Promise<AppUser[]> {
  const { data } = await axios.get<{ users: AppUser[] }>("/api/admin/users");
  return data.users;
}

export async function createUser(request: CreateUserRequest): Promise<AppUser> {
  const { data } = await axios.post<{ user: AppUser }>(
    "/api/admin/users",
    request
  );
  return data.user;
}

export async function updateUser(
  id: string,
  request: UpdateUserRequest
): Promise<AppUser> {
  const { data } = await axios.patch<{ user: AppUser }>(
    `/api/admin/users/${id}`,
    request
  );
  return data.user;
}

export async function deleteUser(id: string): Promise<void> {
  await axios.delete(`/api/admin/users/${id}`);
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
