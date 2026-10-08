import { createContext, useContext } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import type { FieldOption, PaperField } from "../services/firestore/fieldService";
import type { Paper } from "../services/firestore/paperService";
import type { ScreensaverItem } from "../services/firestore/screensaverService";
import type { SearchSnippet } from "../utils/text";

export type EventStatus = "loading" | "ready" | "not-found" | "error";

// Un filtro público: un campo de lista con filter != "none", con el conteo de cada opción (ignora
// su propio filtro y respeta los demás) y lo que el visitante eligió (vacío = no filtra por este campo).
export type PublicFilter = {
  field: PaperField;
  options: (FieldOption & { count: number })[];
  selected: string[];
};

export type SearchMode = "exact" | "semantic" | "both";

// Criterios de la búsqueda avanzada (AdvancedSearchModal). Se combinan entre sí y con la búsqueda
// normal y los filtros. Los campos de lista no van aquí: comparten la selección de los filtros.
export type AdvancedSearch = {
  title: string;
  authors: string;
  // Texto extraído del PDF.
  body: string;
  // Por campo de texto del evento: texto que debe contener.
  text: Record<string, string>;
  // Por campo numérico del evento: rango inclusivo (null = sin límite).
  ranges: Record<string, { min: number | null; max: number | null }>;
};

export const EMPTY_ADVANCED_SEARCH: AdvancedSearch = { title: "", authors: "", body: "", text: {}, ranges: {} };

// Cuántos criterios de texto/rango tiene (sin contar los campos de lista).
export const countAdvancedCriteria = (search: AdvancedSearch) =>
  [search.title, search.authors, search.body, ...Object.values(search.text)].filter((v) => v.trim()).length +
  Object.values(search.ranges).filter((r) => r.min !== null || r.max !== null).length;

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
  // Prende/apaga una opción del filtro.
  toggleFilterOption: (fieldId: string, optionId: string) => void;
  // Opciones elegidas por campo de lista (filtros y búsqueda avanzada comparten esta selección).
  selectedOptions: Record<string, string[]>;
  // Reemplaza la selección completa de un campo de lista (desde la búsqueda avanzada).
  setFieldSelection: (fieldId: string, optionIds: string[]) => void;
  advancedSearch: AdvancedSearch;
  setAdvancedSearch: (search: AdvancedSearch) => void;
  // true si el evento tiene filtros, el visitante no ha elegido nada en ninguno y no está buscando:
  // en vez de listar todos los pósters se le pide elegir (PosterList).
  selectionRequired: boolean;
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
