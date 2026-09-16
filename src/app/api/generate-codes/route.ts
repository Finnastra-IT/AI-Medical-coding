import { NextResponse } from "next/server";
import { generateCodesRequestSchema } from "@/lib/schemas";
import { mockSuggestedCodes } from "@/lib/mockData";

// TODO: Replace with Optum API call — read OPTUM_CLIENT_ID / OPTUM_CLIENT_SECRET
// from process.env.

const MOCK_DELAY_MS = 1500;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = generateCodesRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  return NextResponse.json(mockSuggestedCodes);
}
