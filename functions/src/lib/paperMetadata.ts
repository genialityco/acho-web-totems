import { createHash } from "node:crypto";

// Versión del índice de búsqueda (qué entra al embedding y cómo). Al subirla, el reintento diario
// (retryPaperSearchIndex) re-indexa solo los papers indexados con una versión anterior.
// v2: el embedding incluye título y campos del evento, no solo el texto del PDF.
export const INDEX_VERSION = 2;

export interface FieldDoc {
  id: string;
  label?: unknown;
  type?: unknown;
  order?: unknown;
  options?: unknown;
}

// Lo que de un paper entra al índice de búsqueda. Autores e institución no: los cubre la
// búsqueda exacta, y en el embedding solo meterían ruido (no dicen de qué trata el póster).
export interface PaperIndexInputs {
  title: string;
  urlPdf: string;
  attributes: Record<string, unknown>;
}

export const readPaperIndexInputs = (data: Record<string, unknown> | undefined): PaperIndexInputs => ({
  title: typeof data?.title === "string" ? data.title.trim() : "",
  urlPdf: typeof data?.urlPdf === "string" ? data.urlPdf : "",
  attributes: data?.attributes && typeof data.attributes === "object" ? (data.attributes as Record<string, unknown>) : {},
});

// Forma canónica de los atributos (claves y listas ordenadas) para que reordenar las opciones de un
// multiselect no cuente como un cambio.
const canonicalAttributes = (attributes: Record<string, unknown>) =>
  Object.keys(attributes)
    .sort()
    .map((key) => {
      const value = attributes[key];
      return [key, Array.isArray(value) ? [...value].map(String).sort() : value ?? null];
    });

// Firma de lo que produce el índice de un paper: si no cambió, su índice sigue vigente. La usan el
// trigger (para no re-indexar por un voto o una vista) y la escritura final del indexado (para no
// guardar un resultado viejo si el paper cambió mientras se procesaba).
export const indexSignature = (inputs: PaperIndexInputs): string =>
  createHash("sha1")
    .update(JSON.stringify([INDEX_VERSION, inputs.urlPdf, inputs.title, canonicalAttributes(inputs.attributes)]))
    .digest("hex");

const sortFields = (fields: FieldDoc[]) =>
  [...fields].sort((a, b) => (typeof a.order === "number" ? a.order : 0) - (typeof b.order === "number" ? b.order : 0));

// Valores de los campos del evento (events/{slug}/fields) en el paper, como "Nombre: valor". Los
// campos de lista guardan ids de opciones, que se traducen a sus nombres. `skipNumbers` omite los
// campos numéricos (año, etc.), que no aportan significado a un embedding.
export const describeAttributes = (
  fields: FieldDoc[],
  attributes: Record<string, unknown>,
  { skipNumbers = false }: { skipNumbers?: boolean } = {}
): string[] =>
  sortFields(fields).flatMap((field) => {
    if (skipNumbers && field.type === "number") return [];
    const label = typeof field.label === "string" ? field.label : field.id;
    const value = attributes[field.id];
    const optionName = new Map(
      (Array.isArray(field.options) ? field.options : [])
        .filter((o): o is { id: string; name: string } => typeof o?.id === "string" && typeof o?.name === "string")
        .map((o) => [o.id, o.name])
    );
    const ids = Array.isArray(value) ? value : [value];
    const text = optionName.size
      ? ids.map((id) => optionName.get(String(id))).filter(Boolean).join(", ")
      : typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
    return text ? [`${label}: ${text}`] : [];
  });
