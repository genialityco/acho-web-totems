import type { IndexOutcome } from "../search/indexPaper";

// Papers que se indexan en paralelo. El ritmo real lo pone el presupuesto de tokens por minuto de
// lib/gemini.ts; esto solo acota la memoria de la función y cuántas descargas de PDF hay a la vez.
export const REINDEX_CONCURRENCY = 5;

// Corre `task` sobre `items` en tandas de a lo sumo `concurrency` y cuenta los resultados. Antes de
// cada tanda consulta `shouldContinue`: así quien llama corta a tiempo (ej. antes del timeout de la
// función) y deja el resto para la llamada siguiente.
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<IndexOutcome>,
  shouldContinue: () => boolean = () => true
): Promise<{ summary: Partial<Record<IndexOutcome, number>>; processed: number }> {
  const summary: Partial<Record<IndexOutcome, number>> = {};
  let processed = 0;
  for (let i = 0; i < items.length && shouldContinue(); i += concurrency) {
    const outcomes = await Promise.all(items.slice(i, i + concurrency).map(task));
    outcomes.forEach((outcome) => (summary[outcome] = (summary[outcome] ?? 0) + 1));
    processed += outcomes.length;
  }
  return { summary, processed };
}
