import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type ExtractedDocument = {
  text: string;
  fileType: string;
  warnings?: string[];
};

const SUPPORTED_TYPES = [
  "pdf",
  "docx",
  "xlsx",
  "xls",
  "csv",
  "txt",
] as const;

export type SupportedFileType = (typeof SUPPORTED_TYPES)[number];

export function isSupportedFileType(ext: string): ext is SupportedFileType {
  return (SUPPORTED_TYPES as readonly string[]).includes(ext.toLowerCase());
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

/**
 * Extract searchable text from a file buffer based on file type.
 * Returns the text content the tutor will use as RAG context.
 */
export async function extractText(
  buffer: ArrayBuffer | Uint8Array,
  filename: string
): Promise<ExtractedDocument> {
  const ext = getFileExtension(filename);
  if (!isSupportedFileType(ext)) {
    throw new Error(
      `Unsupported file type: ".${ext}". Supported: ${SUPPORTED_TYPES.join(", ")}.`
    );
  }

  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  switch (ext) {
    case "pdf":
      return extractFromPdf(bytes);
    case "docx":
      return extractFromDocx(bytes);
    case "xlsx":
    case "xls":
      return extractFromExcel(bytes, ext);
    case "csv":
      return extractFromCsv(bytes);
    case "txt":
      return { text: new TextDecoder().decode(bytes), fileType: "txt" };
  }
}

async function extractFromPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { text } = await extractPdfText(bytes, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : text;
  return { text: merged.trim(), fileType: "pdf" };
}

async function extractFromDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });
  return {
    text: result.value.trim(),
    fileType: "docx",
    warnings: result.messages?.map((m) => m.message),
  };
}

/**
 * Excel files are tabular. We render each sheet as a labeled CSV-like block
 * so the embedding model and the tutor see structure (headers + rows).
 */
function extractFromExcel(
  bytes: Uint8Array,
  ext: "xlsx" | "xls"
): ExtractedDocument {
  const workbook = XLSX.read(bytes, { type: "array" });
  const blocks: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // CSV preserves rows + columns in a way the LLM reads well.
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (!csv.trim()) continue;

    blocks.push(`### Sheet: ${sheetName}\n${csv.trim()}`);
  }

  return {
    text: blocks.join("\n\n"),
    fileType: ext,
  };
}

function extractFromCsv(bytes: Uint8Array): ExtractedDocument {
  return {
    text: new TextDecoder().decode(bytes).trim(),
    fileType: "csv",
  };
}
