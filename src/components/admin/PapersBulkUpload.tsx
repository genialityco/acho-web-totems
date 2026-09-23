import { useAdminEvent } from "../../context/useAdminEvent";
import { importPapers, PaperInput, parseAuthors } from "../../services/firestore/paperService";
import { isHttpUrl, normalizeText } from "../../utils/text";
import BulkUploadPanel, { PreviewRow } from "./BulkUploadPanel";
import { getCell, RawRow } from "./bulkUtils";

const HEADERS = ["title", "authors", "institution", "categoryName", "theme", "urlPdf"];

export default function PapersBulkUpload() {
  const { eventSlug, categories, papers } = useAdminEvent();

  const validate = (rawRows: RawRow[]): PreviewRow<PaperInput>[] => {
    const categoryIdByName = new Map(categories.map((c) => [normalizeText(c.name), c.id]));
    const existingTitles = new Set(papers.map((p) => normalizeText(p.title)));
    const seenTitles = new Set<string>();

    return rawRows.map((raw) => {
      const cells = HEADERS.map((header) => getCell(raw, header));
      const [title, authors, institution, categoryName, theme, urlPdf] = cells;
      const error = (message: string): PreviewRow<PaperInput> => ({ cells, status: "ERROR", message });

      if (!title) return error("Falta el título");
      if (!isHttpUrl(urlPdf)) return error("urlPdf debe ser una URL http(s) válida");

      let categoryId: string | null = null;
      if (categoryName) {
        categoryId = categoryIdByName.get(normalizeText(categoryName)) ?? null;
        if (!categoryId) return error(`La categoría "${categoryName}" no existe; créala primero`);
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
          categoryId,
          theme: theme || null,
        },
      };
    });
  };

  return (
    <BulkUploadPanel
      title="Carga masiva de papers"
      hint="Una fila por paper. Separa varios autores con punto y coma (;). categoryName debe coincidir con el nombre de una categoría ya creada (o dejarse vacío). Los papers con un título que ya existe se omiten, así que cargar dos veces el mismo archivo no duplica nada."
      headers={HEADERS}
      templateFileName="papers_template.xlsx"
      reportFileName="papers_informe.xlsx"
      backTo={`/admin/${eventSlug}/papers`}
      validate={validate}
      commit={(rows) => importPapers(eventSlug, rows)}
    />
  );
}
