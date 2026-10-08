import { createContext, useContext } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import type { Category } from "../services/firestore/categoryService";
import type { Paper } from "../services/firestore/paperService";
import type { ScreensaverItem } from "../services/firestore/screensaverService";
import type { SearchSnippet } from "../utils/text";

export type EventStatus = "loading" | "ready" | "not-found" | "error";

export type CategoryWithCount = Category & { count: number };

export type StudyTypeWithCount = { name: string; count: number };

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
  // Filtros de selección múltiple: una lista vacía = "Ver todos" (no filtra).
  selectedCategories: string[];
  setSelectedCategories: (categoryIds: string[]) => void;
  selectedStudyTypes: string[];
  setSelectedStudyTypes: (studyTypes: string[]) => void;
  // La fila de tipos de estudio aparece después de que el visitante elige algo en la de categorías
  // (una o varias, o "Ver todos"); si el evento no tiene categorías se muestra desde el inicio.
  // Mientras la fila está oculta, selectedStudyTypes no filtra.
  setStudyTypesRevealed: (revealed: boolean) => void;
  studyTypesVisible: boolean;
  selectedTheme: string | null;
  setSelectedTheme: (theme: string | null) => void;
  categories: CategoryWithCount[];
  // Pósters que pasan los demás filtros sin importar la categoría (el número de "Ver todos").
  allCategoriesCount: number;
  // Tipos de estudio del evento con su conteo (ignora el filtro de tipo, respeta el de categoría).
  studyTypes: StudyTypeWithCount[];
  allStudyTypesCount: number;
  themes: string[];
  getCategoryName: (categoryId: string | null) => string;
};

export const PostersContext = createContext<PostersContextType | undefined>(undefined);

export const usePosters = () => {
  const context = useContext(PostersContext);
  if (context === undefined) {
    throw new Error("usePosters must be used within a PostersProvider");
  }
  return context;
};
