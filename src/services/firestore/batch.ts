import { writeBatch, WriteBatch } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Firestore admite 500 operaciones por lote; se deja margen.
const CHUNK_SIZE = 450;

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Error desconocido";

// Aplica cada fila en lotes atómicos; devuelve, por fila, el error de su lote (o undefined si se guardó).
export const commitRowsInChunks = async <T>(
  rows: T[],
  apply: (batch: WriteBatch, row: T) => void
): Promise<(string | undefined)[]> => {
  const errors: (string | undefined)[] = new Array(rows.length).fill(undefined);
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const slice = rows.slice(start, start + CHUNK_SIZE);
    const batch = writeBatch(db);
    slice.forEach((row) => apply(batch, row));
    try {
      await batch.commit();
    } catch (error) {
      slice.forEach((_, i) => {
        errors[start + i] = errorMessage(error);
      });
    }
  }
  return errors;
};

export const commitOpsInChunks = async (ops: ((batch: WriteBatch) => void)[]) => {
  const errors = await commitRowsInChunks(ops, (batch, op) => op(batch));
  const failed = errors.find((e) => e !== undefined);
  if (failed) throw new Error(failed);
};
