import * as XLSX from "xlsx";
import type { SuggestedCode } from "./types";
import { computeDiagnosisLetters, resolveDxReference } from "./dxReference";

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
// Set once, the first time a handle is ever stored, and never cleared by
// `clearStoredHandle()` — lets `ensureFileHandle()` tell "this coder has
// never picked a file before" (needs the Save picker, to allow creating a
// brand-new file) apart from "they had one and it was cleared/lapsed"
// (needs the Open picker instead — see that function for why).
const EVER_HAD_HANDLE_KEY = "everHadHandle";

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
    tx.objectStore(STORE_NAME).put(true, EVER_HAD_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function hasEverHadHandle(): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(EVER_HAD_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result === true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

// Backfills EVER_HAD_HANDLE_KEY for an install that already had a stored
// handle from before this flag existed — otherwise a coder who picked their
// file under the old code, then uses "Change file" for the first time since
// this fix shipped, would still fall through to the Save picker (and hit
// the exact "already exists, replace?" prompt this whole mechanism exists
// to avoid), since their pre-existing handle never set this key. Called
// whenever ensureFileHandle() finds a stored handle at all — the flag only
// ever needs setting once, so this is a no-op write after the first time.
async function markEverHadHandle(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(true, EVER_HAD_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Lets the UI show a "Change file" control only when there's actually a
// remembered file to change — before the first export, there's nothing to
// reset (clicking "Export to Excel" itself already prompts for a file).
export async function hasStoredHandle(): Promise<boolean> {
  return (await getStoredHandle()) !== null;
}

// Forgets the remembered file so the *next* export prompts again, letting
// the coder pick a different one (or re-pick the same one). Doesn't touch
// the actual file on disk, and — unlike `HANDLE_KEY`, which this does
// clear — deliberately ALSO (re-)sets `EVER_HAD_HANDLE_KEY` rather than
// leaving it alone. This is the primary place that flag gets backfilled for
// an install that stored its handle before the flag existed: the UI only
// ever calls this when "Change file" is visible, which only happens when a
// handle is currently stored — so "this function is running at all" already
// proves "a handle existed," regardless of whether EVER_HAD_HANDLE_KEY
// happened to be set yet. Without this, a coder whose handle predates this
// flag could click "Change file" as their very first action post-fix and
// still fall through to the Save picker next time — the exact "already
// exists, replace?" confusion this mechanism exists to avoid. (See
// `markEverHadHandle()` for the same backfill from the other direction —
// a normal export running before "Change file" is ever clicked.)
export async function clearStoredHandle(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.objectStore(STORE_NAME).put(true, EVER_HAD_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const XLSX_PICKER_TYPES = [
  {
    description: "Excel Workbook",
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        [".xlsx"],
    },
  },
];

// Reuses the previously-picked file across reloads when possible, so the
// coder doesn't re-pick it on every export; only re-prompts when there's no
// stored handle yet or the browser's permission for it has lapsed —
// browsers deliberately don't allow silently reopening a file across
// sessions without this re-confirmation.
//
// Which native picker to show when a prompt IS needed depends on whether
// this coder has ever picked a file before (`hasEverHadHandle()`):
// - Never before → `showSaveFilePicker()`, since they may need to CREATE a
//   brand-new workbook (an "Open" dialog can only select existing files).
// - Before, but the handle is gone now (cleared via "Change file", or
//   permission lapsed) → `showOpenFilePicker()` instead. They're almost
//   certainly re-pointing at an existing file (very likely the very same
//   one), and a Save dialog pointed at an existing file triggers the
//   browser's native "Replace?" confirmation — confusing here, since
//   nothing is actually being replaced (appendCodesToExcelFile always reads
//   the file's existing rows before writing). An Open dialog has no such
//   prompt. Trade-off: a coder can no longer create a *new* file through
//   "Change file" once they've used this feature before — only re-attach to
//   an existing one. If that's ever needed, point them at creating an
//   empty .xlsx by hand first, then picking it.
async function ensureFileHandle(): Promise<FileSystemFileHandle> {
  const stored = await getStoredHandle();
  if (stored) {
    // Backfill for installs that stored a handle before EVER_HAD_HANDLE_KEY
    // existed — see markEverHadHandle()'s own comment for why this matters.
    await markEverHadHandle();
    const granted = await stored.queryPermission({ mode: "readwrite" });
    if (granted === "granted") return stored;
    const requested = await stored.requestPermission({ mode: "readwrite" });
    if (requested === "granted") return stored;
  }

  if (await hasEverHadHandle()) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: XLSX_PICKER_TYPES,
    });
    // Unlike showSaveFilePicker (which grants readwrite automatically since
    // writing is the whole point of a save dialog), a handle from
    // showOpenFilePicker only comes with read permission by default —
    // write needs to be requested explicitly, or the later createWritable()
    // call would fail.
    await handle.requestPermission({ mode: "readwrite" });
    await storeHandle(handle);
    return handle;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: "medicode-suggested-codes.xlsx",
    types: XLSX_PICKER_TYPES,
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
  "Dx Ref",
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

  // A blank row between each export's batch of rows, so a coder scrolling
  // through a file that's accumulated many cases can see at a glance where
  // one case ends and the next begins — only between batches, never before
  // the very first one (nothing to separate yet) or directly under a header
  // with no rows under it. `existingRows.length > 1` means "header plus at
  // least one real data row already there."
  if (existingRows.length > 1) {
    rows.push([]);
  }

  // Dx Ref uses the exact same A/B/C letters shown on screen for this case —
  // safe to export as-is, unlike a letter meant to stand alone across many
  // cases in one sheet, because every row already carries its own Case ID:
  // the letters only ever need to be read in the context of their own row's
  // Case ID, not globally across the whole file. See AGENTS.md "Diagnosis
  // pointer hint" for the "hint only, not exported" decision this revises.
  const diagnosisLetters = computeDiagnosisLetters(codes);
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
      resolveDxReference(code, diagnosisLetters) ?? "",
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
