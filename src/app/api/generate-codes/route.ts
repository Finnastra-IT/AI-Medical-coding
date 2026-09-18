import { NextResponse } from "next/server";
import { generateCodesRequestSchema } from "@/lib/schemas";

// TODO: Replace with a real Optum API call once OPTUM_CLIENT_ID /
// OPTUM_CLIENT_SECRET (process.env) are provisioned. This is the optional
// "second opinion" step — Step 1 (POST /api/analyze) already assigns
// ICD-10/CPT codes per diagnosis/procedure via OpenAI, and the frontend uses
// those immediately; this endpoint exists for a coder who additionally wants
// Optum-sourced suggestions. Until Optum is wired up, always report
// "coming soon" rather than returning fake data.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = generateCodesRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: "Optum integration is coming soon." },
    { status: 501 }
  );
}
