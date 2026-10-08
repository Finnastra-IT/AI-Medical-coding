import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { getSessionUser } from "@/lib/auth";

// Extracts plain text from an uploaded .docx or .pdf file so it can be
// loaded into the SOAP note textarea. .txt files never hit this route —
// SoapInput.tsx reads those directly in the browser via file.text().
//
// This is a plain multipart file upload, not a JSON body, so it doesn't go
// through lib/schemas.ts like the other routes — see AGENTS.md "SOAP note
// de-identification" for why that's fine here (no secrets, no AI call,
// just local text extraction on our own server). Still requires a valid
// session, same as every other route — see "Authentication & admin user
// management" there.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // generous for a text-based note

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 10MB)" },
      { status: 400 }
    );
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: result.value });
    }

    if (name.endsWith(".pdf")) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        // Join per-page text ourselves rather than using result.text, which
        // inserts "-- N of M --" page-separator markers we don't want ending
        // up in the note.
        const text = result.pages.map((page) => page.text).join("\n\n");
        return NextResponse.json({ text });
      } finally {
        await parser.destroy();
      }
    }

    return NextResponse.json(
      {
        error:
          "Unsupported file type. Please upload a .txt, .docx, or .pdf file.",
      },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read file";
    return NextResponse.json(
      { error: `Failed to extract text from file: ${message}` },
      { status: 502 }
    );
  }
}
