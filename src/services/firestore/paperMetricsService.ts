import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

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
