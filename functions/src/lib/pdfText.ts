// pdfjs-dist (desde v5) se distribuye solo como ESM; import() dinámico es la
// única forma de cargarlo desde este proyecto (compilado a CommonJS). Ver
// tsconfig.json ("module": "node16") — necesario para que TS no baje este
// import() a un require() síncrono, que fallaría contra un paquete .mjs.
function loadPdfjsLib() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}
let pdfjsLibPromise: ReturnType<typeof loadPdfjsLib> | null = null;
const getPdfjsLib = () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = loadPdfjsLib();
  }
  return pdfjsLibPromise;
};

export const MAX_PDF_FETCH_BYTES = 35 * 1024 * 1024; // margen sobre el límite de 30MB de storage.rules, para URLs externas
export const MAX_STORED_TEXT_CHARS = 20_000;
export const MAX_EMBEDDING_INPUT_CHARS = 8_000;

export type ExtractResult =
  | { ok: true; text: string; textLength: number }
  | { ok: false; reason: "unsupported" | "error"; message: string };

async function downloadPdfBytes(url: string): Promise<Uint8Array | { error: string }> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { error: "No se pudo descargar el archivo PDF." };
  }
  if (!response.ok || !response.body) {
    return { error: `No se pudo descargar el archivo PDF (HTTP ${response.status}).` };
  }
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PDF_FETCH_BYTES) {
    return { error: "El archivo PDF supera el tamaño máximo permitido." };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_PDF_FETCH_BYTES) {
        await reader.cancel().catch(() => {});
        return { error: "El archivo PDF supera el tamaño máximo permitido." };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const PDF_MAGIC = "%PDF-";

export async function fetchAndExtractPdfText(url: string): Promise<ExtractResult> {
  const downloaded = await downloadPdfBytes(url);
  if ("error" in downloaded) {
    return { ok: false, reason: "unsupported", message: downloaded.error };
  }

  const header = Buffer.from(downloaded.subarray(0, PDF_MAGIC.length)).toString("latin1");
  if (header !== PDF_MAGIC) {
    return { ok: false, reason: "unsupported", message: "El archivo no es un PDF válido." };
  }

  try {
    const pdfjsLib = await getPdfjsLib();
    const loadingTask = pdfjsLib.getDocument({ data: downloaded, useSystemFonts: false });
    const doc = await loadingTask.promise;

    let text = "";
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      text += (text ? "\n" : "") + pageText;
      if (text.length >= MAX_STORED_TEXT_CHARS) break;
    }
    await loadingTask.destroy();

    const trimmed = text.trim();
    if (!trimmed) {
      return {
        ok: false,
        reason: "unsupported",
        message: "No se pudo extraer texto del PDF (posible documento escaneado sin capa de texto).",
      };
    }

    const truncated = trimmed.slice(0, MAX_STORED_TEXT_CHARS);
    return { ok: true, text: truncated, textLength: trimmed.length };
  } catch (err) {
    console.error(`Error extrayendo texto de ${url}:`, err);
    return { ok: false, reason: "error", message: "No se pudo procesar el archivo PDF." };
  }
}
