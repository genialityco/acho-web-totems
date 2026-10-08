import { useAdminEvent } from "../../context/useAdminEvent";
import { PaperAttributes } from "../../services/firestore/fieldService";
import { importPapers, PaperInput, parseAuthors } from "../../services/firestore/paperService";
import { isHttpUrl, normalizeText } from "../../utils/text";
import BulkUploadPanel, { PreviewRow } from "./BulkUploadPanel";
import { getCell, RawRow } from "./bulkUtils";

// Columnas fijas; después van las de los campos del evento, con el nombre de cada campo como encabezado.
const BASE_HEADERS = ["title", "authors", "institution", "urlPdf"];

export default function PapersBulkUpload() {
  const { eventSlug, fields, papers } = useAdminEvent();
  const headers = [...BASE_HEADERS, ...fields.map((f) => f.label)];

  const validate = (rawRows: RawRow[]): PreviewRow<PaperInput>[] => {
    const optionIdByName = new Map(
      fields.map((f) => [f.id, new Map(f.options.map((o) => [normalizeText(o.name), o.id]))])
    );
    const existingTitles = new Set(papers.map((p) => normalizeText(p.title)));
    const seenTitles = new Set<string>();

    return rawRows.map((raw) => {
      const cells = headers.map((header) => getCell(raw, header));
      const [title, authors, institution, urlPdf] = cells;
      const error = (message: string): PreviewRow<PaperInput> => ({ cells, status: "ERROR", message });

      if (!title) return error("Falta el título");
      if (!isHttpUrl(urlPdf)) return error("urlPdf debe ser una URL http(s) válida");

      const attributes: PaperAttributes = {};
      for (const [i, field] of fields.entries()) {
        const raw = cells[BASE_HEADERS.length + i];
        if (!raw) {
          if (field.required) return error(`Falta «${field.label}» (obligatorio)`);
          continue;
        }
        if (field.type === "number") {
          const value = Number(raw.replace(",", "."));
          if (!Number.isFinite(value)) return error(`«${field.label}» debe ser un número`);
          attributes[field.id] = value;
        } else if (field.type === "text") {
          attributes[field.id] = raw;
        } else {
          // Listas: por nombre de opción; varias opciones separadas por punto y coma.
          const names = field.type === "multiselect" ? raw.split(";").map((n) => n.trim()).filter(Boolean) : [raw];
          const ids: string[] = [];
          for (const name of names) {
            const id = optionIdByName.get(field.id)?.get(normalizeText(name));
            if (!id) return error(`«${name}» no es una opción de «${field.label}»; créala primero`);
            ids.push(id);
          }
          attributes[field.id] = field.type === "multiselect" ? ids : ids[0];
        }
      }

      const titleKey = normalizeText(title);
      if (existingTitles.has(titleKey)) {
        return { cells, status: "SKIPPED", message: "Ya existe un paper con este título" };
      }
      if (seenTitles.has(titleKey)) {
        return { cells, status: "SKIPPED", message: "Título repetido en el archivo" };
      }
      seenTitles.add(titleKey);

      return {
        cells,
        status: "OK",
        message: "Se creará",
        data: {
          title,
          authors: parseAuthors(authors),
          institution,
          urlPdf,
          urlVideo: null,
          attributes,
        },
      };
    });
  };

  return (
    <BulkUploadPanel
      title="Carga masiva de papers"
      hint="Una fila por paper. Separa varios autores con punto y coma (;). Después de urlPdf va una columna por cada campo del evento (pestaña «Campos»): en los de lista escribe el nombre de una opción ya creada (varias separadas por ;), en los numéricos un número. Los campos obligatorios no pueden quedar vacíos. Los papers con un título que ya existe se omiten, así que cargar dos veces el mismo archivo no duplica nada."
      headers={headers}
      templateFileName="papers_template.xlsx"
      reportFileName="papers_informe.xlsx"
      backTo={`/admin/${eventSlug}/papers`}
      validate={validate}
      commit={(rows) => importPapers(eventSlug, rows)}
    />
  );
}
