// Minúsculas y sin tildes, sin recortar espacios: así las posiciones del texto plegado se
// pueden mapear al original (ver findMatchRanges).
const foldText = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const normalizeText = (text: string) => foldText(text).trim();

// Como normalizeText, pero además colapsa espacios/saltos consecutivos en uno solo. Es la forma
// de comparar en la búsqueda: el texto extraído de un PDF deja espacios múltiples (cursivas,
// columnas) que romperían una frase como "giardia spp" aunque esté escrita tal cual en el documento.
export const normalizeSearchText = (text: string) => normalizeText(text.replace(/\s+/g, " "));

export const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Rangos [inicio, fin) del texto original donde aparece `term`, con el mismo criterio de la
// búsqueda exacta (sin distinguir mayúsculas ni tildes: normalizeText + includes).
export const findMatchRanges = (text: string, term: string, limit = Infinity): Array<[number, number]> => {
  const needle = normalizeSearchText(term);
  if (!needle) return [];

  let folded = foldText(text);
  let starts: number[] | null = null;
  let ends: number[] | null = null;
  // Caso común: plegar no cambia el largo (una vocal con tilde precompuesta sigue siendo un
  // carácter) y no hay espacios raros, así que las posiciones coinciden. Si el largo cambia (ej.
  // tildes como carácter combinante aparte) o hay espacios múltiples / no estándar (que la
  // búsqueda trata como uno solo), se arma el mapa carácter a carácter.
  if (folded.length !== text.length || /[^\S ]| {2}/.test(text)) {
    folded = "";
    starts = [];
    ends = [];
    let position = 0;
    for (const char of text) {
      // Una racha de espacios cuenta como un solo espacio, anclado al primero de la racha.
      const foldedChar = /\s/.test(char) ? (folded.endsWith(" ") ? "" : " ") : foldText(char);
      for (let i = 0; i < foldedChar.length; i += 1) {
        starts.push(position);
        ends.push(position + char.length);
      }
      folded += foldedChar;
      position += char.length;
    }
  }

  const ranges: Array<[number, number]> = [];
  let index = folded.indexOf(needle);
  while (index !== -1 && ranges.length < limit) {
    const last = index + needle.length - 1;
    ranges.push([starts ? starts[index] : index, ends ? ends[last] : last + 1]);
    index = folded.indexOf(needle, index + needle.length);
  }
  return ranges;
};

export type SearchSnippet = { before: string; match: string; after: string };

// Fragmento del texto alrededor de la primera coincidencia de `term`, con ~`radius` caracteres
// de contexto a cada lado, sin palabras cortadas en los extremos y con los espacios colapsados
// (el texto extraído de un PDF trae saltos de línea y espacios dobles). null si no hay coincidencia.
export const buildSnippet = (text: string, term: string, radius = 60): SearchSnippet | null => {
  const [range] = findMatchRanges(text, term, 1);
  if (!range) return null;
  const [start, end] = range;

  const collapse = (value: string) => value.replace(/\s+/g, " ");
  const cutLeft = start - radius > 0;
  const cutRight = end + radius < text.length;
  const before = collapse(text.slice(Math.max(0, start - radius), start));
  const after = collapse(text.slice(end, end + radius));

  return {
    before: (cutLeft ? "…" : "") + (cutLeft ? before.replace(/^\S+\s/, "") : before.trimStart()),
    match: collapse(text.slice(start, end)),
    after: (cutRight ? after.replace(/\s\S+$/, "") : after.trimEnd()) + (cutRight ? "…" : ""),
  };
};
