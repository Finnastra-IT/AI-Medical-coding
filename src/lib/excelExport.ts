import * as XLSX from "xlsx";
import type { SuggestedCode } from "./types";

// Appends Suggested Codes rows to a single persistent local .xlsx file across
// exports, so a coder handling many cases ends up with one running workbook
// instead of a new file per export. Browser-only (client components), and
// only works in Chromium browsers (Chrome/Edge) — it's built on the File
// System Access API (`showSaveFilePicker`, `FileSystemFileHandle`), which
// Firefox/Safari don't implement. See AGENTS.md "Exporting suggested codes to
// a persistent Excel file" for the full picture and why this can't work the
// same way in every browser.

const DB_NAME = "medicode-excel-export";
const STORE_NAME = "handles";
const HANDLE_KEY = "codesFileHandle";

export function isExcelExportSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () =>
        resolve((req.result as FileSystemFileHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB unavailable or the stored handle is from an incompatible
    // browser profile — fall back to prompting for a file instead of failing.
    return null;
  }
}

async function storeHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Reuses the previously-picked file across reloads when possible, so the
// coder doesn't re-pick it on every export; only re-prompts with the native
// "Save As" dialog when there's no stored handle yet or the browser's
// permission for it has lapsed — browsers deliberately don't allow silently
// reopening a file across sessions without this re-confirmation.
async function ensureFileHandle(): Promise<FileSystemFileHandle> {
  const stored = await getStoredHandle();
  if (stored) {
    const granted = await stored.queryPermission({ mode: "readwrite" });
    if (granted === "granted") return stored;
    const requested = await stored.requestPermission({ mode: "readwrite" });
    if (requested === "granted") return stored;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: "medicode-suggested-codes.xlsx",
    types: [
      {
        description: "Excel Workbook",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            [".xlsx"],
        },
      },
    ],
  });
  await storeHandle(handle);
  return handle;
}

const HEADER_ROW = [
  "Case ID",
  "Exported At",
  "Code",
  "Description",
  "Type",
  "Source",
  "Modifier",
  "Units",
];

async function readExistingRows(
  handle: FileSystemFileHandle
): Promise<unknown[][]> {
  const file = await handle.getFile();
  if (file.size === 0) return [];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
    });
  } catch {
    // Not a readable workbook (e.g. the coder picked an unrelated or
    // corrupted file) — treat as empty rather than failing the export.
    return [];
  }
}

// Appends one row per suggested code to the persistent file, tagged with the
// given case id and an export timestamp, so rows from different SOAP notes
// stay traceable in one running sheet.
export async function appendCodesToExcelFile(
  caseId: string,
  codes: SuggestedCode[]
): Promise<void> {
  const handle = await ensureFileHandle();
  const existingRows = await readExistingRows(handle);
  const rows = existingRows.length > 0 ? existingRows : [HEADER_ROW];

  const exportedAt = new Date().toISOString();
  for (const code of codes) {
    rows.push([
      caseId,
      exportedAt,
      code.code,
      code.description,
      code.type,
      code.source,
      code.modifier ?? "",
      code.units ?? "",
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Suggested Codes");
  const data = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}
