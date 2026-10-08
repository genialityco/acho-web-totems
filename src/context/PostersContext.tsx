import React, { useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { useMediaQuery } from "@mantine/hooks";
import { subscribeEvent, EventInfo } from "../services/firestore/eventService";
import { isListField, optionIdsOf, PaperField, subscribeFields } from "../services/firestore/fieldService";
import { subscribePapers, Paper } from "../services/firestore/paperService";
import { subscribeScreensaverItems, ScreensaverItem } from "../services/firestore/screensaverService";
import { subscribePaperSearchIndex, PaperSearchIndex } from "../services/firestore/paperSearchIndexService";
import { embedSearchQuery } from "../services/firestore/searchQueryService";
import { buildSnippet, normalizeSearchText, normalizeText, SearchSnippet } from "../utils/text";
import { cosineSimilarity } from "../utils/vectorMath";
import { RESPONSIVE_BREAKPOINTS_EM } from "../theme";
import { trackEvent } from "../services/analytics";
import {
  AdvancedSearch,
  countAdvancedCriteria,
  EMPTY_ADVANCED_SEARCH,
  EventStatus,
  PostersContext,
  PublicFilter,
  SearchMode,
} from "./usePosters";

// Umbral mínimo de caracteres antes de pedir un embedding de la búsqueda.
const SEMANTIC_MIN_TERM_LENGTH = 3;
const SEMANTIC_DEBOUNCE_MS = 400;
// Espera a que la persona deje de teclear antes de mandar el evento de analítica, para no
// mandar uno por cada letra escrita.
const SEARCH_TRACK_DEBOUNCE_MS = 800;
// Los cosenos de gemini-embedding-001 entre una consulta y los papers de un
// evento caen en una banda angosta (~0.5–0.75, incluso para una consulta sin
// relación), así que un umbral bajo deja pasar todo. Un paper es relevante en
// modo conceptual si supera el piso absoluto (descarta consultas sin señal) Y
// está a no más de SEMANTIC_RELATIVE_WINDOW del mejor puntaje de esa consulta
// (adapta el corte: las consultas cortas puntúan más bajo que las largas).
const SEMANTIC_THRESHOLD = 0.62;
const SEMANTIC_RELATIVE_WINDOW = 0.06;
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
  const [fields, setFields] = useState<PaperField[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);
  const [screensaverItems, setScreensaverItems] = useState<ScreensaverItem[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("exact");
  const [page, setPage] = useState(1);
  // Por campo: opciones elegidas en su filtro (vacío = no filtra por ese campo), y si el visitante ya tocó ese
  // filtro (revela el siguiente, si tiene revealAfterPrevious).
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [touchedFilters, setTouchedFilters] = useState<Record<string, boolean>>({});
  const [advancedSearch, setAdvancedSearch] = useState<AdvancedSearch>(EMPTY_ADVANCED_SEARCH);

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
      subscribeFields(
        eventSlug,
        (list) => {
          setFields(list);
          setFieldsLoaded(true);
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
  const loading = eventStatus === "loading" || !postersLoaded || !fieldsLoaded;

  // Texto de cada PDF ya indexado: `text` con los espacios colapsados (es el que se muestra en el
  // fragmento) y `folded` en minúsculas y sin tildes (contra el que se compara). Se calcula al
  // cambiar el índice y no en cada tecla, porque la búsqueda exacta lo compara con todos los papers.
  const bodyByPaperId = useMemo(() => {
    const bodies = new Map<string, { text: string; folded: string }>();
    searchIndexByPaperId.forEach((index, paperId) => {
      if (index.status !== "ready") return;
      const text = index.extractedText.replace(/\s+/g, " ").trim();
      bodies.set(paperId, { text, folded: normalizeText(text) });
    });
    return bodies;
  }, [searchIndexByPaperId]);

  // Filtros visibles, en orden: uno con revealAfterPrevious solo aparece si el anterior está visible
  // y el visitante ya tocó una opción en él.
  const visibleFilterFields = useMemo(() => {
    const visible: PaperField[] = [];
    let previous: { field: PaperField; visible: boolean } | null = null;
    for (const field of fields) {
      if (!isListField(field) || field.filter === "none") continue;
      const isVisible: boolean =
        !field.revealAfterPrevious || !previous || (previous.visible && !!touchedFilters[previous.field.id]);
      if (isVisible) visible.push(field);
      previous = { field, visible: isVisible };
    }
    return visible;
  }, [fields, touchedFilters]);

  // Selección efectiva por campo de lista: los que no son filtro público (solo se eligen en la búsqueda
  // avanzada) y los filtros visibles (uno oculto no filtra).
  const activeSelections = useMemo(
    () =>
      fields
        .filter((field) => isListField(field) && (field.filter === "none" || visibleFilterFields.includes(field)))
        .map((field) => ({ fieldId: field.id, selected: selectedOptions[field.id] ?? [] }))
        .filter(({ selected }) => selected.length > 0),
    [fields, visibleFilterFields, selectedOptions]
  );

  const { filteredPosters, filterCounts, semanticOnlyIds } = useMemo(() => {
    const term = normalizeSearchText(searchTerm);

    // Título > autor > cuerpo del PDF (solo si ya está indexado). Devuelve 0
    // si no hay match exacto en ningún campo.
    const exactScore = (paper: Paper): number => {
      if (normalizeSearchText(paper.title).includes(term)) return EXACT_TITLE_SCORE;
      if (paper.authors.some((author) => normalizeSearchText(author).includes(term))) return EXACT_AUTHOR_SCORE;
      if (bodyByPaperId.get(paper.id)?.folded.includes(term)) return EXACT_BODY_SCORE;
      return 0;
    };

    // Similitud coseno contra el embedding de cada paper, calculada una sola
    // vez. Quedan fuera los papers sin embedding listo (y todos, mientras no
    // haya embedding de la consulta). El mejor puntaje se toma sobre todo el
    // evento, sin filtros de categoría/tema, para que el corte no cambie al filtrar.
    const semanticScores = new Map<string, number>();
    if (queryEmbedding) {
      posters.forEach((paper) => {
        const index = searchIndexByPaperId.get(paper.id);
        if (index?.status === "ready" && index.embedding) {
          semanticScores.set(paper.id, cosineSimilarity(queryEmbedding, index.embedding));
        }
      });
    }
    const bestSemanticScore = Math.max(0, ...semanticScores.values());
    const semanticCutoff = Math.max(SEMANTIC_THRESHOLD, bestSemanticScore - SEMANTIC_RELATIVE_WINDOW);

    // Puntaje conceptual del paper, o null si no llega al corte de la consulta.
    const semanticScore = (paper: Paper): number | null => {
      const score = semanticScores.get(paper.id);
      return score !== undefined && score >= semanticCutoff ? score : null;
    };

    // null = el paper no matchea la búsqueda actual; un número = su puntaje
    // de orden (mayor primero). Sin término de búsqueda, todos entran con 0.
    const searchScore = (paper: Paper): number | null => {
      if (!term) return 0;
      if (searchMode === "exact") {
        const score = exactScore(paper);
        return score > 0 ? score : null;
      }
      if (searchMode === "semantic") return semanticScore(paper);
      // "both": un match exacto siempre gana (bonus fijo por encima del máximo
      // posible de similitud coseno), si no hay exacto se prueba lo conceptual.
      const eScore = exactScore(paper);
      if (eScore > 0) return EXACT_MATCH_BONUS + eScore;
      return semanticScore(paper);
    };

    // Cada conteo ignora su propio filtro (para mostrar cuántos habría al elegir esa opción) pero
    // respeta la búsqueda y todos los demás filtros.
    // Búsqueda avanzada: todos los criterios deben cumplirse (sin tildes ni mayúsculas).
    const includes = (text: string, criterion: string) =>
      !criterion.trim() || normalizeSearchText(text).includes(normalizeSearchText(criterion));
    const matchesAdvanced = (paper: Paper) =>
      includes(paper.title, advancedSearch.title) &&
      (!advancedSearch.authors.trim() || paper.authors.some((a) => includes(a, advancedSearch.authors))) &&
      (!advancedSearch.body.trim() ||
        !!bodyByPaperId.get(paper.id)?.folded.includes(normalizeSearchText(advancedSearch.body))) &&
      Object.entries(advancedSearch.text).every(([fieldId, criterion]) =>
        includes(String(paper.attributes[fieldId] ?? ""), criterion)
      ) &&
      Object.entries(advancedSearch.ranges).every(([fieldId, { min, max }]) => {
        if (min === null && max === null) return true;
        const value = paper.attributes[fieldId];
        if (typeof value !== "number") return false;
        return (min === null || value >= min) && (max === null || value <= max);
      });

    const matches = (paper: Paper, ignoreFieldId: string | null) =>
      searchScore(paper) !== null &&
      matchesAdvanced(paper) &&
      activeSelections.every(
        ({ fieldId, selected }) =>
          fieldId === ignoreFieldId || optionIdsOf(paper.attributes[fieldId]).some((id) => selected.includes(id))
      );

    const counts = new Map<string, Map<string, number>>();
    visibleFilterFields.forEach((field) => {
      const byOption = new Map<string, number>();
      posters.forEach((paper) => {
        if (!matches(paper, field.id)) return;
        optionIdsOf(paper.attributes[field.id]).forEach((id) => byOption.set(id, (byOption.get(id) ?? 0) + 1));
      });
      counts.set(field.id, byOption);
    });

    const filtered = posters.filter((paper) => matches(paper, null));
    // posters ya llega alfabético (subscribePapers); sort() es estable, así
    // que ese orden queda como desempate cuando el puntaje es igual.
    if (term) {
      filtered.sort((a, b) => (searchScore(b) ?? 0) - (searchScore(a) ?? 0));
    }

    // Resultados que están ahí solo por significado: no tienen nada resaltado ni fragmento con
    // el que se justifiquen (en modo conceptual no se resalta nada; en "Ambas" los exactos ya
    // se explican solos). Son los únicos que pueden pedir una explicación.
    const semanticOnly = new Set<string>();
    if (term && searchMode !== "exact") {
      filtered.forEach((paper) => {
        if (semanticScore(paper) !== null && (searchMode === "semantic" || exactScore(paper) === 0)) {
          semanticOnly.add(paper.id);
        }
      });
    }

    return {
      filteredPosters: filtered,
      filterCounts: counts,
      semanticOnlyIds: semanticOnly,
    };
  }, [
    posters,
    searchTerm,
    visibleFilterFields,
    activeSelections,
    advancedSearch,
    searchMode,
    searchIndexByPaperId,
    bodyByPaperId,
    queryEmbedding,
  ]);

  // Analítica de búsqueda: un evento por búsqueda (no por tecla), y solo cuando el resultado
  // ya es válido (en modo semántico/ambas espera a que llegue el embedding de la consulta).
  const debouncedTrackSearch = useMemo(
    () =>
      debounce((mode: SearchMode, hasResults: boolean) => {
        trackEvent("search_used", { event_slug: eventSlug, search_mode: mode, has_results: hasResults });
      }, SEARCH_TRACK_DEBOUNCE_MS),
    [eventSlug]
  );
  useEffect(() => () => debouncedTrackSearch.cancel(), [debouncedTrackSearch]);

  useEffect(() => {
    if (!normalizeText(searchTerm) || semanticSearchLoading) {
      debouncedTrackSearch.cancel();
      return;
    }
    debouncedTrackSearch(searchMode, filteredPosters.length > 0);
  }, [searchTerm, searchMode, filteredPosters.length, semanticSearchLoading, debouncedTrackSearch]);

  const filters: PublicFilter[] = useMemo(
    () =>
      visibleFilterFields.map((field) => {
        const count = filterCounts.get(field.id);
        return {
          field,
          options: field.options.map((o) => ({ ...o, count: count?.get(o.id) ?? 0 })),
          selected: selectedOptions[field.id] ?? [],
        };
      }),
    [visibleFilterFields, filterCounts, selectedOptions]
  );

  const toggleFilterOption = (fieldId: string, optionId: string) => {
    setSelectedOptions((prev) => {
      const current = prev[fieldId] ?? [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [fieldId]: next };
    });
    setTouchedFilters((prev) => ({ ...prev, [fieldId]: true }));
    setPage(1);
  };

  const setFieldSelection = (fieldId: string, optionIds: string[]) => {
    setSelectedOptions((prev) => ({ ...prev, [fieldId]: optionIds }));
    if (optionIds.length) setTouchedFilters((prev) => ({ ...prev, [fieldId]: true }));
    setPage(1);
  };

  const updateAdvancedSearch = (search: AdvancedSearch) => {
    setAdvancedSearch(search);
    setPage(1);
  };

  // Con filtros y sin nada elegido ni buscado (normal o avanzado) no se listan pósters: se pide elegir primero.
  const selectionRequired =
    filters.length > 0 &&
    activeSelections.length === 0 &&
    !normalizeText(searchTerm) &&
    countAdvancedCriteria(advancedSearch) === 0;

  // El primer filtro de tarjetas de colores da el color de cada póster (borde y etiqueta).
  const colorField = fields.find((f) => isListField(f) && f.filter === "cards");
  const getPaperColor = (paper: Paper) => {
    if (!colorField) return null;
    const ids = optionIdsOf(paper.attributes[colorField.id]);
    return colorField.options.find((o) => ids.includes(o.id) && o.color)?.color ?? null;
  };

  const highlightTerm = searchMode === "semantic" ? "" : searchTerm;

  const getBodySnippet = (paperId: string): SearchSnippet | null => {
    const term = normalizeSearchText(highlightTerm);
    if (!term) return null;
    const paper = posters.find((p) => p.id === paperId);
    if (!paper) return null;
    // Título y autores ya se resaltan en la tarjeta; el fragmento solo hace falta si el match está en el cuerpo.
    if (normalizeSearchText(paper.title).includes(term)) return null;
    if (paper.authors.some((author) => normalizeSearchText(author).includes(term))) return null;
    const body = bodyByPaperId.get(paperId);
    return body ? buildSnippet(body.text, term) : null;
  };

  // Mientras el embedding de la consulta está en vuelo los resultados todavía no son válidos.
  const canExplainMatch = (paperId: string) =>
    !!event?.searchExplanationsEnabled && !semanticSearchLoading && semanticOnlyIds.has(paperId);

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
        totalResults: filteredPosters.length,
        highlightTerm,
        getBodySnippet,
        canExplainMatch,
        loading,
        page: currentPage,
        setPage,
        totalPages,
        fields,
        filters,
        toggleFilterOption,
        selectionRequired,
        selectedOptions,
        setFieldSelection,
        advancedSearch,
        setAdvancedSearch: updateAdvancedSearch,
        getPaperColor,
      }}
    >
      {children}
    </PostersContext.Provider>
  );
};
