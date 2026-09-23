import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]/g, "");

export const readSheetRows = async (file: File): Promise<RawRow[]> => {
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
};

// Busca la columna sin importar mayúsculas, tildes, espacios ni guiones.
export const getCell = (row: RawRow, header: string) => {
  const target = normalizeHeader(header);
  const key = Object.keys(row).find((k) => normalizeHeader(k) === target);
  return key === undefined ? "" : String(row[key] ?? "").trim();
};

const saveSheet = (fileName: string, sheetName: string, rows: string[][]) => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName);
};

export const downloadTemplate = (fileName: string, headers: string[]) =>
  saveSheet(fileName, "Plantilla", [headers]);

export const downloadReport = (fileName: string, headers: string[], rows: string[][]) =>
  saveSheet(fileName, "Informe", [headers, ...rows]);
