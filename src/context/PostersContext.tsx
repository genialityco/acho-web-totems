import React, { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { subscribeEvent, EventInfo } from "../services/firestore/eventService";
import { subscribeCategories, Category } from "../services/firestore/categoryService";
import { subscribePapers, Paper } from "../services/firestore/paperService";
import { subscribeScreensaverItems, ScreensaverItem } from "../services/firestore/screensaverService";
import { normalizeText } from "../utils/text";
import { RESPONSIVE_BREAKPOINTS_EM } from "../theme";
import { PostersContext, EventStatus } from "./usePosters";

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
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

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
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [eventSlug]);

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
    const matches = (paper: Paper, ignoreCategory: boolean) => {
      const matchesSearch =
        !term ||
        normalizeText(paper.title).includes(term) ||
        paper.authors.some((author) => normalizeText(author).includes(term));
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

    return {
      filteredPosters: posters.filter((paper) => matches(paper, false)),
      categoryCounts: counts,
    };
  }, [posters, searchTerm, selectedCategory, selectedTheme]);

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
