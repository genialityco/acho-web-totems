import {
  addDoc,
  arrayRemove,
  collection,
  deleteField,
  doc,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  updateDoc,
  WriteBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { commitOpsInChunks } from "./batch";

// Campos (atributos) de los papers, definidos por evento en events/{slug}/fields/{fieldId}.
// Cada paper guarda sus valores en `attributes[fieldId]`: texto, número, el id de una opción
// (select) o una lista de ids de opciones (multiselect). Los campos de lista tienen su propia
// pestaña en el admin para administrar las opciones, y pueden ser filtro en el sitio público.
export type FieldType = "text" | "number" | "select" | "multiselect";

// none = no es filtro público; cards = tarjetas de colores; buttons = fila de botones.
export type FilterStyle = "none" | "cards" | "buttons";

export interface FieldOption {
  id: string;
  name: string;
  // Nombre de color de Mantine (ej. "blue"); null = sin color.
  color: string | null;
  order: number;
}

export interface PaperField {
  id: string;
  label: string;
  type: FieldType;
  order: number;
  required: boolean;
  // Solo aplica a campos de lista.
  filter: FilterStyle;
  // El filtro solo aparece después de que el visitante elige algo en el filtro anterior.
  revealAfterPrevious: boolean;
  // Se muestra en la tarjeta del póster (y en el detalle).
  showOnCard: boolean;
  // Solo campos de lista; ordenadas por `order`.
  options: FieldOption[];
}

export type FieldInput = Omit<PaperField, "id" | "options">;

export type AttributeValue = string | number | string[];
export type PaperAttributes = Record<string, AttributeValue>;

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  select: "Lista (una opción)",
  multiselect: "Lista (varias opciones)",
};

export const FILTER_STYLE_LABELS: Record<FilterStyle, string> = {
  none: "No es filtro",
  cards: "Tarjetas de colores",
  buttons: "Fila de botones",
};

export const OPTION_COLORS = [
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "red", label: "Rojo" },
  { value: "purple", label: "Morado" },
  { value: "orange", label: "Naranja" },
  { value: "teal", label: "Turquesa" },
  { value: "pink", label: "Rosado" },
  { value: "indigo", label: "Índigo" },
  { value: "gray", label: "Gris" },
];

export const isListField = (field: Pick<PaperField, "type">) =>
  field.type === "select" || field.type === "multiselect";

const FIELD_TYPES: readonly FieldType[] = ["text", "number", "select", "multiselect"];
const FILTER_STYLES: readonly FilterStyle[] = ["none", "cards", "buttons"];

const sortOptions = (options: FieldOption[]) =>
  [...options].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));

const toOption = (raw: unknown): FieldOption | null => {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== "string" || typeof data.name !== "string") return null;
  return {
    id: data.id,
    name: data.name,
    color: typeof data.color === "string" && data.color ? data.color : null,
    order: typeof data.order === "number" ? data.order : 0,
  };
};

const toField = (id: string, data: DocumentData): PaperField => {
  const type: FieldType = FIELD_TYPES.includes(data.type) ? data.type : "text";
  const list = isListField({ type });
  return {
    id,
    label: typeof data.label === "string" && data.label ? data.label : id,
    type,
    order: typeof data.order === "number" ? data.order : 0,
    required: data.required === true,
    filter: list && FILTER_STYLES.includes(data.filter) ? data.filter : "none",
    revealAfterPrevious: data.revealAfterPrevious === true,
    showOnCard: data.showOnCard === true,
    options: list && Array.isArray(data.options)
      ? sortOptions(data.options.map(toOption).filter((o: FieldOption | null): o is FieldOption => !!o))
      : [],
  };
};

export const subscribeFields = (
  slug: string,
  onData: (fields: PaperField[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "fields"),
    (snap) => {
      const fields = snap.docs.map((d) => toField(d.id, d.data()));
      fields.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "es"));
      onData(fields);
    },
    onError
  );

export const createField = async (slug: string, input: FieldInput) => {
  await addDoc(collection(db, "events", slug, "fields"), { ...input, options: [] });
};

export const updateField = (slug: string, id: string, changes: Partial<FieldInput>) =>
  updateDoc(doc(db, "events", slug, "fields", id), changes);

// Quita el valor del campo en sus papers y después borra el campo.
export const deleteFieldAndValues = (slug: string, fieldId: string, paperIdsToClear: string[]) =>
  commitOpsInChunks([
    ...paperIdsToClear.map(
      (paperId) => (batch: WriteBatch) =>
        batch.update(doc(db, "events", slug, "papers", paperId), { [`attributes.${fieldId}`]: deleteField() })
    ),
    (batch: WriteBatch) => batch.delete(doc(db, "events", slug, "fields", fieldId)),
  ]);

// Id nuevo para una opción, generado en el cliente (sin escribir nada).
export const newOptionId = () => doc(collection(db, "events")).id;

// Las opciones se guardan completas en el doc del campo (son pocas por campo).
export const saveFieldOptions = (slug: string, fieldId: string, options: FieldOption[]) =>
  updateDoc(doc(db, "events", slug, "fields", fieldId), { options: sortOptions(options) });

// Quita la opción de los papers que la tienen y después del campo.
export const deleteFieldOption = (slug: string, field: PaperField, optionId: string, paperIdsToClear: string[]) =>
  commitOpsInChunks([
    ...paperIdsToClear.map(
      (paperId) => (batch: WriteBatch) =>
        batch.update(doc(db, "events", slug, "papers", paperId), {
          [`attributes.${field.id}`]: field.type === "multiselect" ? arrayRemove(optionId) : deleteField(),
        })
    ),
    (batch: WriteBatch) =>
      batch.update(doc(db, "events", slug, "fields", field.id), {
        options: field.options.filter((o) => o.id !== optionId),
      }),
  ]);

// --- Lectura de valores ---

// Ids de opciones del valor de un campo de lista (vacío si no tiene).
export const optionIdsOf = (value: AttributeValue | undefined): string[] =>
  Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];

export const hasValue = (value: AttributeValue | undefined) =>
  value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);

// Opciones elegidas, en el orden del campo (ignora ids de opciones que ya no existen).
export const selectedOptions = (field: PaperField, value: AttributeValue | undefined): FieldOption[] => {
  const ids = optionIdsOf(value);
  return field.options.filter((o) => ids.includes(o.id));
};

// Valor legible ("" si no tiene).
export const formatAttribute = (field: PaperField, value: AttributeValue | undefined): string => {
  if (!hasValue(value)) return "";
  if (isListField(field)) return selectedOptions(field, value).map((o) => o.name).join(", ");
  return String(value);
};

// Compara dos valores del mismo campo para ordenar; los vacíos siempre van al final.
export const compareAttributes = (
  field: PaperField,
  a: AttributeValue | undefined,
  b: AttributeValue | undefined,
  direction: 1 | -1
): number => {
  const emptyA = !hasValue(a);
  const emptyB = !hasValue(b);
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (field.type === "number") return (Number(a) - Number(b)) * direction;
  if (isListField(field)) {
    // Por el orden de la primera opción elegida (el orden que el admin les dio), no alfabético.
    const first = (v: AttributeValue | undefined) => selectedOptions(field, v)[0]?.order ?? Infinity;
    return (first(a) - first(b)) * direction;
  }
  return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true }) * direction;
};

// Normaliza el mapa `attributes` leído de Firestore.
export const toAttributes = (raw: unknown): PaperAttributes => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: PaperAttributes = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === "string" && value) result[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    else if (Array.isArray(value)) {
      const ids = value.filter((v): v is string => typeof v === "string" && !!v);
      if (ids.length) result[key] = ids;
    }
  });
  return result;
};
