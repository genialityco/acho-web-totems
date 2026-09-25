import { createContext, useContext } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import type { Category } from "../services/firestore/categoryService";
import type { Paper } from "../services/firestore/paperService";
import type { ScreensaverItem } from "../services/firestore/screensaverService";
import type { SearchSnippet } from "../utils/text";

export type EventStatus = "loading" | "ready" | "not-found" | "error";

export type CategoryWithCount = Category & { count: number };

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
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  selectedCategory: string | null;
  setSelectedCategory: (categoryId: string | null) => void;
  selectedTheme: string | null;
  setSelectedTheme: (theme: string | null) => void;
  categories: CategoryWithCount[];
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
