import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db, functions } from "../firebaseConfig";

type PaperMetric = "view" | "download";

interface IncrementPaperMetricInput {
  eventSlug: string;
  paperId: string;
  metric: PaperMetric;
}

const incrementPaperMetricCallable = httpsCallable<IncrementPaperMetricInput, { ok: boolean }>(
  functions,
  "incrementPaperMetric"
);

// Best-effort: si esto falla (red, cold start, etc.) nunca debe interrumpir la vista o
// descarga real del visitante, así que el error se registra y no se propaga.
const incrementPaperMetric = (input: IncrementPaperMetricInput): Promise<void> =>
  incrementPaperMetricCallable(input)
    .then(() => undefined)
    .catch((error) => {
      console.error(`No se pudo registrar la métrica "${input.metric}":`, error);
    });

export const trackPosterView = (eventSlug: string, paperId: string) =>
  incrementPaperMetric({ eventSlug, paperId, metric: "view" });

export const trackPosterDownload = (eventSlug: string, paperId: string) =>
  incrementPaperMetric({ eventSlug, paperId, metric: "download" });

const resetPaperMetricsCallable = httpsCallable<
  { eventSlug: string },
  { ok: boolean; papersReset: number }
>(functions, "resetPaperMetrics");

export const resetPaperMetrics = async (eventSlug: string) =>
  (await resetPaperMetricsCallable({ eventSlug })).data;

export interface DailyMetric {
  date: string; // yyyy-mm-dd (zona Bogotá)
  views: number;
  downloads: number;
  papers: Record<string, { views: number; downloads: number }>;
}

const asCount = (value: unknown) => (typeof value === "number" ? value : 0);

// Solo admins pueden leer metricsDaily (ver firestore.rules).
export const subscribeDailyMetrics = (
  slug: string,
  onData: (days: DailyMetric[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "metricsDaily"),
    (snap) => {
      const days = snap.docs.map((d) => {
        const data = d.data();
        const rawPapers = (data.papers ?? {}) as Record<string, Record<string, unknown>>;
        const papers: DailyMetric["papers"] = {};
        Object.entries(rawPapers).forEach(([id, m]) => {
          papers[id] = { views: asCount(m?.views), downloads: asCount(m?.downloads) };
        });
        return { date: d.id, views: asCount(data.views), downloads: asCount(data.downloads), papers };
      });
      days.sort((a, b) => a.date.localeCompare(b.date));
      onData(days);
    },
    onError
  );
