import * as XLSX from "xlsx";
import { formatAttribute, type PaperField } from "../../services/firestore/fieldService";
import type { Paper } from "../../services/firestore/paperService";
import type { Voter } from "../../services/firestore/voterService";
import type { VoteRecord } from "../../services/firestore/voteService";
import type { DailyMetric } from "../../services/firestore/paperMetricsService";

type Cell = string | number;

const TIME_ZONE = "America/Bogota";

// "2026-11-17 14:03:22" en hora de Bogotá: texto (no fecha de Excel) para no depender de la zona
// horaria con que SheetJS convierte los Date, y ordenable igual como texto.
const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);

// Hoja con encabezados y ancho de columna según el contenido (tope de 60 caracteres).
const buildSheet = (headers: string[], rows: Cell[][]) => {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = headers.map((header, col) => {
    const longest = rows.reduce((max, row) => Math.max(max, String(row[col] ?? "").length), header.length);
    return { wch: Math.min(Math.max(longest + 2, 8), 60) };
  });
  return sheet;
};

export interface ResultsExportInput {
  eventSlug: string;
  eventName: string;
  fields: PaperField[];
  papers: Paper[];
  voters: Voter[];
  votes: VoteRecord[];
  dailyMetrics: DailyMetric[];
}

export const exportResultsToExcel = ({
  eventSlug,
  eventName,
  fields,
  papers,
  voters,
  votes,
  dailyMetrics,
}: ResultsExportInput) => {
  const now = new Date();
  const book = XLSX.utils.book_new();

  const activeVoters = voters.filter((v) => v.active).length;
  const totalViews = papers.reduce((sum, p) => sum + p.viewCount, 0);
  const totalDownloads = papers.reduce((sum, p) => sum + p.downloadCount, 0);
  const participation = activeVoters > 0 ? Math.round((votes.length / activeVoters) * 100) : 0;

  XLSX.utils.book_append_sheet(
    book,
    buildSheet(
      ["Indicador", "Valor"],
      [
        ["Evento", eventName],
        ["Exportado", `${formatDateTime(now)} (hora de Bogotá)`],
        ["Papers", papers.length],
        ["Votantes activos", activeVoters],
        ["Votos emitidos", votes.length],
        ["Participación (%)", participation],
        ["Vistas de pósters", totalViews],
        ["Descargas de PDF", totalDownloads],
      ]
    ),
    "Resumen"
  );

  // Ranking: mismo orden que la tabla (votos desc, luego título), con todos los campos del evento.
  const ranking = [...papers].sort(
    (a, b) => b.voteCount - a.voteCount || a.title.localeCompare(b.title, "es", { sensitivity: "base" })
  );
  XLSX.utils.book_append_sheet(
    book,
    buildSheet(
      [
        "Posición",
        "Título",
        "Autores",
        "Institución",
        ...fields.map((f) => f.label),
        "Votos",
        "Vistas",
        "Descargas",
        "URL PDF",
      ],
      ranking.map((paper, i) => [
        i + 1,
        paper.title,
        paper.authors.join("; "),
        paper.institution,
        ...fields.map((f) => formatAttribute(f, paper.attributes[f.id])),
        paper.voteCount,
        paper.viewCount,
        paper.downloadCount,
        paper.urlPdf,
      ])
    ),
    "Ranking"
  );

  const voterName = new Map(voters.map((v) => [v.id, v.fullName]));
  const paperTitle = new Map(papers.map((p) => [p.id, p.title]));
  XLSX.utils.book_append_sheet(
    book,
    buildSheet(
      ["Fecha (hora de Bogotá)", "Cédula", "Nombre", "Votó por"],
      [...votes]
        .sort((a, b) => (b.castAt?.getTime() ?? 0) - (a.castAt?.getTime() ?? 0))
        .map((vote) => [
          vote.castAt ? formatDateTime(vote.castAt) : "",
          vote.voterId,
          voterName.get(vote.voterId) || "",
          paperTitle.get(vote.paperId) ?? "(paper eliminado)",
        ])
    ),
    "Votos"
  );

  // Actividad por día: vistas/descargas de metricsDaily + votos agrupados por día de Bogotá.
  const votesByDay = new Map<string, number>();
  votes.forEach((v) => {
    if (!v.castAt) return;
    const k = dayKey(v.castAt);
    votesByDay.set(k, (votesByDay.get(k) ?? 0) + 1);
  });
  const metricsByDay = new Map(dailyMetrics.map((d) => [d.date, d]));
  const allDays = [...new Set([...metricsByDay.keys(), ...votesByDay.keys()])].sort();
  XLSX.utils.book_append_sheet(
    book,
    buildSheet(
      ["Fecha", "Vistas", "Descargas", "Votos"],
      allDays.map((day) => [
        day,
        metricsByDay.get(day)?.views ?? 0,
        metricsByDay.get(day)?.downloads ?? 0,
        votesByDay.get(day) ?? 0,
      ])
    ),
    "Actividad diaria"
  );

  // Detalle por póster y día (solo filas con actividad).
  const detailRows: Cell[][] = [];
  dailyMetrics.forEach((day) => {
    Object.entries(day.papers).forEach(([paperId, m]) => {
      if (m.views === 0 && m.downloads === 0) return;
      detailRows.push([day.date, paperTitle.get(paperId) ?? "(paper eliminado)", m.views, m.downloads]);
    });
  });
  XLSX.utils.book_append_sheet(
    book,
    buildSheet(["Fecha", "Póster", "Vistas", "Descargas"], detailRows),
    "Actividad por póster"
  );

  XLSX.writeFile(book, `resultados-${eventSlug}-${dayKey(now)}.xlsx`);
};
