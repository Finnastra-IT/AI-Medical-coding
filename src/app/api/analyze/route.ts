import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "@/lib/schemas";
import { analyzeWithOpenAI, NotMedicalNoteError } from "@/lib/openai";

// Calls OpenAI (see lib/openai.ts) using OPENAI_API_KEY from process.env,
// server-side only — never exposed to the client.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyzeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const summary = await analyzeWithOpenAI(parsed.data.soapNote);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof NotMedicalNoteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
