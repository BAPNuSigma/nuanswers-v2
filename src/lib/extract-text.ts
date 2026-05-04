import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parseOffice } from "officeparser";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export type ExtractedDocument = {
  text: string;
  fileType: string;
  warnings?: string[];
};

const SUPPORTED_TYPES = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "xls",
  "csv",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

const IMAGE_MEDIA_TYPES: Record<ImageExtension, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Vision prompt: extract text + structure ONLY. Tutor philosophy is preserved
// because the bot itself never sees the image — it only sees the extracted
// text in the same RAG pipeline as PDFs/slides. The vision step does NOT
// solve, hint, or comment on the problem.
const VISION_EXTRACTION_PROMPT = `You are a text-extraction assistant for an AI accounting tutor that helps students reason through problems (the tutor never gives direct answers).

This image is likely a homework problem, textbook page, class slide, lecture note, or whiteboard photo from an FDU accounting student.

Your job: extract ALL visible content verbatim.
- Read every word, number, formula, label, table cell, axis title, caption, and header.
- Preserve structure: render tables as CSV-style blocks with headers; lists stay as lists; equations get normalized to plain text (e.g. write "x^2", not styled superscript).
- If the image is a problem statement, end with one final line: "This appears to be about: [topic, e.g. depreciation, journal entries, FIFO/LIFO]."
- If parts are blurry, write [unclear: <best guess>] in place of the unreadable text.

Do NOT solve the problem, give the answer, drop hints, or add commentary. The student will reason through it themselves with the tutor.`;

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
    case "pptx":
      return extractFromPptx(bytes);
    case "xlsx":
    case "xls":
      return extractFromExcel(bytes, ext);
    case "csv":
      return extractFromCsv(bytes);
    case "txt":
      return { text: new TextDecoder().decode(bytes), fileType: "txt" };
    case "jpg":
    case "jpeg":
    case "png":
    case "webp":
      return extractFromImage(bytes, ext);
  }
}

async function extractFromImage(
  bytes: Uint8Array,
  ext: ImageExtension
): Promise<ExtractedDocument> {
  const model = openai(process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini");
  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_EXTRACTION_PROMPT },
          {
            type: "image",
            image: bytes,
            mediaType: IMAGE_MEDIA_TYPES[ext],
          },
        ],
      },
    ],
  });
  const text = result.text.trim();
  if (!text) {
    throw new Error(
      "Vision model returned no text. Try a clearer or higher-resolution photo."
    );
  }
  return { text, fileType: ext };
}

async function extractFromPptx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const ast = await parseOffice(Buffer.from(bytes));
  return { text: ast.toText().trim(), fileType: "pptx" };
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
