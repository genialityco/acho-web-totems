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
// Versión del algoritmo de extracción. Se guarda en el índice: un texto extraído con una versión
// anterior no se reutiliza al re-generar el embedding, se vuelve a extraer del PDF.
export const EXTRACTOR_VERSION = 2;

interface PositionedItem {
  str: string;
  transform: number[];
  width: number;
  hasEOL?: boolean;
}

// Une los fragmentos de texto de una página según su posición, no con un espacio fijo: dos
// fragmentos pegados en la misma línea (ej. "S" + "exo", común en pósters de Canva) forman una sola
// palabra, uno separado lleva espacio, y un cambio de línea lleva salto. Texto rotado: siempre espacio.
export function joinTextItems(items: PositionedItem[]): string {
  let text = "";
  let previous: { y: number; endX: number; fontSize: number; rotated: boolean } | null = null;
  let pendingBreak = false;

  for (const item of items) {
    const [a, b, c, d, x, y] = item.transform;
    const fontSize = Math.hypot(c, d) || 1;
    const rotated = Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3 || a < 0;
    if (!item.str) {
      // pdfjs marca los fines de línea con fragmentos vacíos.
      if (item.hasEOL) pendingBreak = true;
      continue;
    }

    let separator = "";
    if (previous) {
      const sameLine = !pendingBreak && Math.abs(y - previous.y) < previous.fontSize * 0.5;
      if (!sameLine) {
        separator = "\n";
      } else if (
        rotated ||
        previous.rotated ||
        // Superíndices/subíndices (afiliaciones "Otálvaro d", citas): otro tamaño o desplazados.
        Math.abs(fontSize - previous.fontSize) > Math.max(fontSize, previous.fontSize) * 0.2 ||
        Math.abs(y - previous.y) > Math.min(fontSize, previous.fontSize) * 0.15
      ) {
        separator = " ";
      } else {
        const gap = x - previous.endX;
        // Pegados (gap ~0, ej. "S" + "exo"): misma palabra. Cualquier hueco real, o un salto hacia
        // atrás (otra columna a la misma altura): espacio.
        separator = gap > fontSize * 0.06 || gap < -fontSize * 0.5 ? " " : "";
      }
    }
    text += separator + item.str;
    previous = { y, endX: x + item.width, fontSize, rotated };
    pendingBreak = !!item.hasEOL;
  }
  return text;
}

// Candidata a texto con espaciado entre letras: 4+ fragmentos de 1–3 letras separados por un espacio.
const LETTER_SPACED_RUN = /(?<!\p{L})(?:\p{L}{1,3} ){3,}\p{L}{1,3}(?!\p{L})/gu;
const MAX_WORD_LENGTH = 30;
const SINGLE_LETTER_WORDS = new Set(["a", "e", "o", "u", "y"]);
// Palabras frecuentes en encabezados de pósters, que a veces solo aparecen deletreadas en el
// documento y entonces no estarían en su propio vocabulario.
const BASE_VOCABULARY = new Set(
  (
    "de del la las el los en y o con por para una un al su sus se que como entre sin sobre " +
    "congreso nacional internacional investigación introducción objetivo objetivos metodología métodos " +
    "materiales resultados conclusiones conclusión discusión referencias bibliografía reporte caso casos " +
    "serie estudio estudios descriptivo descriptivos analítico analítica observacional retrospectivo " +
    "prospectivo cohorte revisión tema pacientes paciente tratamiento diagnóstico análisis características " +
    "clínicas clínica clínicos hematología oncología cáncer colombia trabajo antecedentes justificación " +
    "hallazgos limitaciones recomendaciones agradecimientos autores palabras clave seguridad presentación " +
    "categoría especial premio premios concurso acho"
  ).split(" ")
);

const wordCounts = (text: string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const word of text.match(/\p{L}+/gu) ?? []) {
    const lower = word.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  return counts;
};

// Separa en palabras un texto sin espacios ("trombocitemiaesencialencolombia") con las palabras
// conocidas: la segmentación con menos palabras, contando cada letra desconocida como más cara que
// una palabra. Si casi nada es conocido devuelve el texto junto, sin inventar cortes.
function segmentWords(joined: string, vocabulary: Set<string>): string {
  const lower = joined.toLowerCase();
  const n = lower.length;
  const cost = new Array<number>(n + 1).fill(Infinity);
  const back = new Array<{ from: number; known: boolean }>(n + 1);
  cost[0] = 0;
  for (let end = 1; end <= n; end += 1) {
    for (let start = Math.max(0, end - MAX_WORD_LENGTH); start < end; start += 1) {
      const word = lower.slice(start, end);
      const known = vocabulary.has(word);
      if (!known && end - start > 1) continue;
      const stepCost = known ? 1 : 3;
      if (cost[start] + stepCost < cost[end]) {
        cost[end] = cost[start] + stepCost;
        back[end] = { from: start, known };
      }
    }
  }

  const tokens: Array<{ text: string; known: boolean }> = [];
  for (let end = n; end > 0; end = back[end].from) {
    const { from, known } = back[end];
    const piece = joined.slice(from, end);
    // Las letras desconocidas consecutivas forman un solo token.
    if (!known && tokens.length && !tokens[0].known) tokens[0].text = piece + tokens[0].text;
    else tokens.unshift({ text: piece, known });
  }
  const unknownChars = tokens.filter((t) => !t.known).reduce((sum, t) => sum + t.text.length, 0);
  return unknownChars > n * 0.3 ? joined : tokens.map((t) => t.text).join(" ");
}

// Repara el texto con espaciado entre letras (títulos de Canva y similares), que pdfjs entrega
// como "T R O M B O C I T E M I A" o "C ON GR ES O N AC I ONA L": junta cada racha y la re-separa
// en palabras con el vocabulario del resto del documento, `hint` (ej. el título del paper) y
// BASE_VOCABULARY. Una racha solo se toca si la mayoría de sus fragmentos no son palabras
// conocidas, para no alterar texto normal hecho de palabras cortas ("y a la de").
function repairLetterSpacing(text: string, hint: string): string {
  // Vocabulario sin las rachas candidatas: sus fragmentos ("GR", "TA") no son palabras.
  const counts = wordCounts(`${hint} ${text.replace(LETTER_SPACED_RUN, " ")}`);
  const vocabulary = new Set<string>(BASE_VOCABULARY);
  counts.forEach((_, word) => {
    if (word.length > 1 || SINGLE_LETTER_WORDS.has(word)) vocabulary.add(word);
  });

  return text.replace(LETTER_SPACED_RUN, (run) => {
    const tokens = run.split(" ");
    const unknown = tokens.filter((t) => !vocabulary.has(t.toLowerCase())).length;
    // Varias letras sueltas: descarta referencias como "Zhu W et al" o "Rojas E, Gil M".
    const singles = tokens.filter((t) => t.length === 1).length;
    const isLetterSpaced = unknown / tokens.length >= 0.5 && singles >= 3 && singles / tokens.length >= 0.3;
    return isLetterSpaced ? segmentWords(tokens.join(""), vocabulary) : run;
  });
}

// Une palabras que pdfjs partió por el kerning ("t ransformaciones", "Hodgk in", "cohort es"): dos
// fragmentos contiguos se unen si juntos forman una palabra que el documento (o `hint`) usa entera y
// al menos uno no es una palabra (aparece una sola vez y no es de BASE_VOCABULARY).
function joinSplitWords(text: string, hint: string): string {
  const counts = wordCounts(`${hint} ${text}`);
  const isFragment = (word: string) => {
    const lower = word.toLowerCase();
    if (BASE_VOCABULARY.has(lower)) return false;
    if (lower.length === 1) return !SINGLE_LETTER_WORDS.has(lower);
    return (counts.get(lower) ?? 0) <= 1;
  };
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const word = parts[i];
    const next = parts[i + 2];
    if (
      parts[i + 1] === " " &&
      next !== undefined &&
      /^\p{L}+$/u.test(word) &&
      /^\p{L}+$/u.test(next) &&
      (counts.get((word + next).toLowerCase()) ?? 0) >= 1 &&
      (isFragment(word) || isFragment(next))
    ) {
      out.push(word + next);
      i += 2;
    } else {
      out.push(word);
    }
  }
  return out.join("");
}

// Limpieza del texto crudo de pdfjs; exportada para poder probarla sin un PDF.
export const cleanExtractedText = (text: string, hint = ""): string =>
  joinSplitWords(repairLetterSpacing(joinHyphenatedLineBreaks(text), hint), hint);

// Une palabras partidas con guion al final de línea ("trata-\nmiento"), solo entre minúsculas.
const joinHyphenatedLineBreaks = (text: string) =>
  text.replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2");

export type ExtractResult =
  | { ok: true; text: string; textLength: number }
  | { ok: false; reason: "unsupported" | "error"; message: string };

// `permanent`: reintentar no cambiaría el resultado (archivo demasiado grande). Los fallos de red o
// HTTP sí pueden ser pasajeros, y el reintento automático (retryPaperSearchIndex) los vuelve a intentar.
async function downloadPdfBytes(url: string): Promise<Uint8Array | { error: string; permanent: boolean }> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { error: "No se pudo descargar el archivo PDF.", permanent: false };
  }
  if (!response.ok || !response.body) {
    return { error: `No se pudo descargar el archivo PDF (HTTP ${response.status}).`, permanent: false };
  }
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PDF_FETCH_BYTES) {
    return { error: "El archivo PDF supera el tamaño máximo permitido.", permanent: true };
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
        return { error: "El archivo PDF supera el tamaño máximo permitido.", permanent: true };
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

// `hint`: texto conocido del paper (ej. su título) que ayuda a reparar el texto con espaciado entre letras.
export async function fetchAndExtractPdfText(url: string, hint = ""): Promise<ExtractResult> {
  const downloaded = await downloadPdfBytes(url);
  if ("error" in downloaded) {
    return { ok: false, reason: downloaded.permanent ? "unsupported" : "error", message: downloaded.error };
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
      const pageText = joinTextItems(content.items.flatMap((item) => ("str" in item ? [item] : [])));
      text += (text ? "\n" : "") + pageText;
      if (text.length >= MAX_STORED_TEXT_CHARS) break;
    }
    await loadingTask.destroy();

    const trimmed = cleanExtractedText(text, hint).trim();
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
