import { NextResponse } from "next/server";
import { optumSearchRequestSchema } from "@/lib/schemas";
import { searchOptumCodes } from "@/lib/optum";

// Live, real Optum RealTime eContent term search — used for the per-field
// "Search Optum" option on a blank ICD-10/CPT/HCPCS code. Distinct from
// POST /api/generate-codes, which is a different (still "coming soon")
// feature — see AGENTS.md.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = optumSearchRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const results = await searchOptumCodes(
      parsed.data.term,
      parsed.data.codeType
    );
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optum search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
