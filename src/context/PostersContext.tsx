import React, { useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { useMediaQuery } from "@mantine/hooks";
import { subscribeEvent, EventInfo } from "../services/firestore/eventService";
import { subscribeCategories, Category } from "../services/firestore/categoryService";
import { subscribePapers, Paper } from "../services/firestore/paperService";
import { subscribeScreensaverItems, ScreensaverItem } from "../services/firestore/screensaverService";
import { subscribePaperSearchIndex, PaperSearchIndex } from "../services/firestore/paperSearchIndexService";
import { embedSearchQuery } from "../services/firestore/searchQueryService";
import { normalizeText } from "../utils/text";
import { cosineSimilarity } from "../utils/vectorMath";
import { RESPONSIVE_BREAKPOINTS_EM } from "../theme";
import { PostersContext, EventStatus, SearchMode } from "./usePosters";

// Umbral mínimo de caracteres antes de pedir un embedding de la búsqueda, y
// de similitud coseno para considerar un paper relevante en modo conceptual.
const SEMANTIC_MIN_TERM_LENGTH = 3;
const SEMANTIC_THRESHOLD = 0.5;
const SEMANTIC_DEBOUNCE_MS = 400;
// Puntajes de búsqueda exacta (título > autor > cuerpo del PDF) y el bonus que
// garantiza, en modo "Ambas", que un match exacto siempre supere a uno solo conceptual.
const EXACT_TITLE_SCORE = 3;
const EXACT_AUTHOR_SCORE = 2;
const EXACT_BODY_SCORE = 1;
const EXACT_MATCH_BONUS = 100;

export const PostersProvider: React.FC<{
  eventSlug: string;
  children: React.ReactNode;
}> = ({ eventSlug, children }) => {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [eventLoaded, setEventLoaded] = useState(false);
  const [posters, setPosters] = useState<Paper[]>([]);
  const [postersLoaded, setPostersLoaded] = useState(false);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [screensaverItems, setScreensaverItems] = useState<ScreensaverItem[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("exact");
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  const [searchIndexByPaperId, setSearchIndexByPaperId] = useState<Map<string, PaperSearchIndex>>(new Map());
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
  const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
  const lastEmbeddedTermRef = useRef<string | null>(null);
  const embedRequestIdRef = useRef(0);

  // Más ítems por página en pantallas grandes/TV, para que la grilla más densa
  // (ver PosterList) no deje una fila final vacía. Cada valor es múltiplo de las
  // columnas de esa franja (10=2x5, 12=3x4, 16=4x4, 20=5x4, 24=6x4).
  // Se compara por ancho O alto: una TV/pantalla gigante en vertical (ej. 1080x1920)
  // es angosta pero altísima, así que solo mirar el ancho la trataría como una
  // pantalla mediana cualquiera.
  const isLgUp = useMediaQuery(`(min-width: ${RESPONSIVE_BREAKPOINTS_EM.lg}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.lg})`);
  const isXlUp = useMediaQuery(`(min-width: ${RESPONSIVE_BREAKPOINTS_EM.xl}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.xl})`);
  const isTvUp = useMediaQuery(`(min-width: ${RESPONSIVE_BREAKPOINTS_EM.tv}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.tv})`);
  const isGiantUp = useMediaQuery(`(min-width: ${RESPONSIVE_BREAKPOINTS_EM.giant}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.giant})`);
  const itemsPerPage = isGiantUp ? 24 : isTvUp ? 20 : isXlUp ? 16 : isLgUp ? 12 : 10;

  useEffect(() => {
    const fail = (error: Error) => {
      console.error("Error al cargar el evento:", error);
      setLoadFailed(true);
    };
    const unsubscribers = [
      subscribeEvent(
        eventSlug,
        (info) => {
          setEvent(info);
          setEventLoaded(true);
        },
        fail
      ),
      subscribePapers(
        eventSlug,
        (papers) => {
          setPosters(papers);
          setPostersLoaded(true);
        },
        fail
      ),
      subscribeCategories(
        eventSlug,
        (list) => {
          setCategoryList(list);
          setCategoriesLoaded(true);
        },
        fail
      ),
      subscribeScreensaverItems(eventSlug, setScreensaverItems, fail),
      subscribePaperSearchIndex(
        eventSlug,
        (items) => setSearchIndexByPaperId(new Map(items.map((item) => [item.paperId, item]))),
        fail
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [eventSlug]);

  // Búsqueda conceptual: pide (debounced) el embedding del término actual y lo
  // guarda para que el useMemo de más abajo calcule similitud coseno contra
  // cada paper ya indexado. embedRequestIdRef descarta respuestas de
  // términos que quedaron obsoletos mientras la llamada estaba en vuelo.
  const debouncedEmbedQuery = useMemo(
    () =>
      debounce((term: string, requestId: number) => {
        embedSearchQuery(term)
          .then((embedding) => {
            if (embedRequestIdRef.current !== requestId) return;
            lastEmbeddedTermRef.current = normalizeText(term);
            setQueryEmbedding(embedding);
          })
          .catch((error) => {
            console.error("Error al generar el embedding de búsqueda:", error);
            if (embedRequestIdRef.current === requestId) setQueryEmbedding(null);
          })
          .finally(() => {
            if (embedRequestIdRef.current === requestId) setSemanticSearchLoading(false);
          });
      }, SEMANTIC_DEBOUNCE_MS),
    []
  );
  useEffect(() => () => debouncedEmbedQuery.cancel(), [debouncedEmbedQuery]);

  useEffect(() => {
    const normalizedTerm = normalizeText(searchTerm);
    if (searchMode === "exact" || normalizedTerm.length < SEMANTIC_MIN_TERM_LENGTH) {
      debouncedEmbedQuery.cancel();
      embedRequestIdRef.current += 1;
      lastEmbeddedTermRef.current = null;
      setQueryEmbedding(null);
      setSemanticSearchLoading(false);
      return;
    }
    if (normalizedTerm === lastEmbeddedTermRef.current) return;

    const requestId = (embedRequestIdRef.current += 1);
    setSemanticSearchLoading(true);
    debouncedEmbedQuery(searchTerm, requestId);
  }, [searchTerm, searchMode, debouncedEmbedQuery]);

  const eventStatus: EventStatus = loadFailed
    ? "error"
    : !eventLoaded
    ? "loading"
    : event
    ? "ready"
    : "not-found";
  const loading = eventStatus === "loading" || !postersLoaded || !categoriesLoaded;

  const { filteredPosters, categoryCounts } = useMemo(() => {
    const term = normalizeText(searchTerm);

    // Título > autor > cuerpo del PDF (solo si ya está indexado). Devuelve 0
    // si no hay match exacto en ningún campo.
    const exactScore = (paper: Paper): number => {
      if (normalizeText(paper.title).includes(term)) return EXACT_TITLE_SCORE;
      if (paper.authors.some((author) => normalizeText(author).includes(term))) return EXACT_AUTHOR_SCORE;
      const index = searchIndexByPaperId.get(paper.id);
      if (index?.status === "ready" && normalizeText(index.extractedText).includes(term)) return EXACT_BODY_SCORE;
      return 0;
    };

    // Similitud coseno contra el embedding del paper (null si el paper aún
    // no tiene embedding listo, o si todavía no hay embedding de la consulta).
    const semanticScore = (paper: Paper): number | null => {
      if (!queryEmbedding) return null;
      const index = searchIndexByPaperId.get(paper.id);
      if (index?.status !== "ready" || !index.embedding) return null;
      return cosineSimilarity(queryEmbedding, index.embedding);
    };

    // null = el paper no matchea la búsqueda actual; un número = su puntaje
    // de orden (mayor primero). Sin término de búsqueda, todos entran con 0.
    const searchScore = (paper: Paper): number | null => {
      if (!term) return 0;
      if (searchMode === "exact") {
        const score = exactScore(paper);
        return score > 0 ? score : null;
      }
      if (searchMode === "semantic") {
        const score = semanticScore(paper);
        return score !== null && score >= SEMANTIC_THRESHOLD ? score : null;
      }
      // "both": un match exacto siempre gana (bonus fijo por encima del máximo
      // posible de similitud coseno), si no hay exacto se prueba lo conceptual.
      const eScore = exactScore(paper);
      if (eScore > 0) return EXACT_MATCH_BONUS + eScore;
      const sScore = semanticScore(paper);
      return sScore !== null && sScore >= SEMANTIC_THRESHOLD ? sScore : null;
    };

    const matches = (paper: Paper, ignoreCategory: boolean) => {
      const matchesSearch = searchScore(paper) !== null;
      const matchesCategory =
        ignoreCategory || !selectedCategory || paper.categoryId === selectedCategory;
      const matchesTheme = !selectedTheme || paper.theme === selectedTheme;
      return matchesSearch && matchesCategory && matchesTheme;
    };

    const counts = new Map<string, number>();
    posters.forEach((paper) => {
      if (paper.categoryId && matches(paper, true)) {
        counts.set(paper.categoryId, (counts.get(paper.categoryId) ?? 0) + 1);
      }
    });

    const filtered = posters.filter((paper) => matches(paper, false));
    // posters ya llega alfabético (subscribePapers); sort() es estable, así
    // que ese orden queda como desempate cuando el puntaje es igual.
    if (term) {
      filtered.sort((a, b) => (searchScore(b) ?? 0) - (searchScore(a) ?? 0));
    }

    return {
      filteredPosters: filtered,
      categoryCounts: counts,
    };
  }, [posters, searchTerm, selectedCategory, selectedTheme, searchMode, searchIndexByPaperId, queryEmbedding]);

  const categories = useMemo(
    () => categoryList.map((c) => ({ ...c, count: categoryCounts.get(c.id) ?? 0 })),
    [categoryList, categoryCounts]
  );

  const themes = useMemo(
    () =>
      Array.from(new Set(posters.map((paper) => paper.theme).filter((t): t is string => !!t))).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [posters]
  );

  const getCategoryName = (categoryId: string | null) =>
    categoryList.find((c) => c.id === categoryId)?.name ?? "";

  const totalPages = Math.max(1, Math.ceil(filteredPosters.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPagePosters = filteredPosters.slice(startIndex, startIndex + itemsPerPage);

  return (
    <PostersContext.Provider
      value={{
        eventSlug,
        event,
        eventStatus,
        posters,
        currentPagePosters,
        screensaverItems,
        searchTerm,
        setSearchTerm,
        searchMode,
        setSearchMode,
        semanticSearchLoading,
        loading,
        page: currentPage,
        setPage,
        totalPages,
        selectedCategory,
        setSelectedCategory,
        selectedTheme,
        setSelectedTheme,
        categories,
        themes,
        getCategoryName,
      }}
    >
      {children}
    </PostersContext.Provider>
  );
};
