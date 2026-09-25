import axios from "axios";
import type { OptumCodeType, OptumSearchNode } from "./types";

// Fixed vendor endpoints — not per-environment config, so these are code
// constants rather than env vars (only the credentials below are secrets).
const OPTUM_TOKEN_URL = "https://apigw.optum.com/apip/auth/sntl/v1/token";
const OPTUM_SEARCH_BASE = "https://realtimeecontent.com/ws/codetype";
const MAX_RESULTS = 50;

// Refresh a little before actual expiry so an in-flight request never races
// the token's real cutoff.
const TOKEN_REFRESH_SKEW_MS = 60_000;

// In-memory only: fine for a single Node process, but gets reset on every
// cold start/redeploy and isn't shared across instances. Revisit with a
// shared cache (e.g. Redis) if this is ever deployed multi-instance.
let cachedToken: { value: string; expiresAt: number } | null = null;

interface OptumTokenResponse {
  access_token: string;
  expires_in: number;
}

async function fetchAccessToken(): Promise<{
  value: string;
  expiresAt: number;
}> {
  const clientId = process.env.OPTUM_CLIENT_ID;
  const clientSecret = process.env.OPTUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "OPTUM_CLIENT_ID/OPTUM_CLIENT_SECRET are not configured on the server",
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await axios.post<OptumTokenResponse>(OPTUM_TOKEN_URL, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  console.log(response);
  return {
    value: response.data.access_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (
    cachedToken &&
    cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()
  ) {
    return cachedToken.value;
  }
  cachedToken = await fetchAccessToken();
  return cachedToken.value;
}

interface OptumSearchResponse {
  termSearchGroup?: OptumSearchNode[];
}

async function runSearch(term: string, codeType: OptumCodeType, token: string) {
  return axios.get<OptumSearchResponse>(
    `${OPTUM_SEARCH_BASE}/${codeType}/termsearchgroups/${encodeURIComponent(term)}`,
    {
      params: { data: "rank,desc,desc-full", maxresults: MAX_RESULTS },
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    },
  );
}

export async function searchOptumCodes(
  term: string,
  codeType: OptumCodeType,
): Promise<OptumSearchNode[]> {
  const token = await getAccessToken();

  try {
    const response = await runSearch(term, codeType, token);
    return response.data.termSearchGroup ?? [];
  } catch (error) {
    // The in-memory token cache should keep this from happening in practice,
    // but if the token was rejected (expired early, revoked, clock skew),
    // force a fresh one and retry exactly once before giving up.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      cachedToken = null;
      const freshToken = await getAccessToken();
      const response = await runSearch(term, codeType, freshToken);
      return response.data.termSearchGroup ?? [];
    }

    if (axios.isAxiosError(error)) {
      throw new Error(
        `Optum search failed (${error.response?.status ?? "network error"})`,
      );
    }
    throw error;
  }
}
