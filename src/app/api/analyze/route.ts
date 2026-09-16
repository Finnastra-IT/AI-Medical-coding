import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "@/lib/schemas";
import { mockClinicalSummary } from "@/lib/mockData";
import { analyzeWithOpenAI } from "@/lib/openai";

// Live mode calls OpenAI (see lib/openai.ts) using OPENAI_API_KEY from
// process.env, server-side only — never exposed to the client. Set
// MOCK_MODE=false to enable it; otherwise this route returns mock data.

const MOCK_DELAY_MS = 1500;
const useMock = process.env.MOCK_MODE !== "false";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyzeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  if (useMock) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return NextResponse.json(mockClinicalSummary);
  }

  try {
    const summary = await analyzeWithOpenAI(parsed.data.soapNote);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
