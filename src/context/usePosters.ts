import { createContext, useContext } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import type { FieldOption, PaperField } from "../services/firestore/fieldService";
import type { Paper } from "../services/firestore/paperService";
import type { ScreensaverItem } from "../services/firestore/screensaverService";
import type { SearchSnippet } from "../utils/text";

export type EventStatus = "loading" | "ready" | "not-found" | "error";

// Un filtro público: un campo de lista con filter != "none", con el conteo de cada opción (ignora
// su propio filtro y respeta los demás) y lo que el visitante eligió (vacío = "Ver todos").
export type PublicFilter = {
  field: PaperField;
  options: (FieldOption & { count: number })[];
  // Pósters que pasan los demás filtros, sin importar este (el número de "Ver todos").
  allCount: number;
  selected: string[];
};

export type SearchMode = "exact" | "semantic" | "both";

export type PostersContextType = {
  eventSlug: string;
  event: EventInfo | null;
  eventStatus: EventStatus;
  posters: Paper[];
  currentPagePosters: Paper[];
  screensaverItems: ScreensaverItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  semanticSearchLoading: boolean;
  // Total de pósters que pasan búsqueda y filtros (todas las páginas), para "Resultados: x de y".
  totalResults: number;
  // Término a resaltar en las tarjetas: solo aplica a la parte exacta de la búsqueda ("" en modo
  // conceptual, donde el match es por significado y no hay texto que marcar).
  highlightTerm: string;
  // Fragmento del texto del PDF con el término, solo si el match de ese póster está únicamente
  // ahí (si está en el título o los autores ya se resalta allí). null en cualquier otro caso.
  getBodySnippet: (paperId: string) => SearchSnippet | null;
  // true si el póster aparece solo por significado y el admin activó las explicaciones del evento
  // (ver MatchExplanation): la tarjeta ofrece entonces "¿Por qué este resultado?".
  canExplainMatch: (paperId: string) => boolean;
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  // Campos del evento (para mostrar los valores en las tarjetas y en el detalle).
  fields: PaperField[];
  // Solo los filtros visibles, en el orden de los campos. Uno con revealAfterPrevious aparece
  // cuando el visitante elige algo en el filtro anterior; mientras está oculto no filtra.
  filters: PublicFilter[];
  // Prende/apaga una opción del filtro; null = "Ver todos" (vacía la selección de ese filtro).
  toggleFilterOption: (fieldId: string, optionId: string | null) => void;
  // Color del póster: el de su opción en el primer filtro de tarjetas de colores (null si no tiene).
  getPaperColor: (paper: Paper) => string | null;
};

export const PostersContext = createContext<PostersContextType | undefined>(undefined);

export const usePosters = () => {
  const context = useContext(PostersContext);
  if (context === undefined) {
    throw new Error("usePosters must be used within a PostersProvider");
  }
  return context;
};
