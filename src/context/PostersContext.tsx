import React, { createContext, useContext, useState, useEffect } from "react";
import { searchPosters, Poster } from "../services/api/posterService";

type PostersContextType = {
  posters: Poster[];
  currentPagePosters: Poster[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  selectedTopic: string | null;
  setSelectedTopic: (topic: string | null) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  topics: { topic: string; count: number; color: string }[];
  categories: string[];
};

const PostersContext = createContext<PostersContextType | undefined>(undefined);

export const PostersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [allPosters, setAllPosters] = useState<Poster[]>([]);
  const [currentPagePosters, setCurrentPagePosters] = useState<Poster[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [topics, setTopics] = useState<
    { topic: string; count: number; color: string }[]
  >([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Carga inicial de todos los pósters
  const fetchAllPosters = async () => {
    setLoading(true);
    try {
      const response = (await searchPosters({ page: 1, limit: 300 })) as {
        status: string;
        data: { items: Poster[] };
      };
      if (response.status === "success") {
        setAllPosters(response.data.items);
        setTotalPages(Math.ceil(response.data.items.length / itemsPerPage));
        updateTopics(response.data.items);
        setCategories(
          Array.from(
            new Set(response.data.items.map((poster) => poster.category))
          ).filter(Boolean)
        );
      }
    } catch (error) {
      setAllPosters([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const updateTopics = (posters: Poster[]) => {
    const topicCounts = posters.reduce(
      (acc: { [key: string]: number }, poster) => {
        if (poster.topic) {
          acc[poster.topic] = (acc[poster.topic] || 0) + 1;
        }
        return acc;
      },
      {}
    );

    const baseTopics = [
      { topic: "Categoría Especial", color: "green" },
      { topic: "Estudios Analíticos", color: "purple" },
      { topic: "Estudios Descriptivos", color: "blue" },
      { topic: "Reporte de Casos", color: "red" },
    ];

    const newTopics = baseTopics.map(({ topic, color }) => ({
      topic,
      count: topicCounts[topic] || 0,
      color,
    }));
    setTopics(newTopics);
  };

  useEffect(() => {
    fetchAllPosters();
  }, []);

  // Normalización para remover tildes
  const normalizeText = (text: string) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Filtrado en el frontend según el término de búsqueda y filtros
  useEffect(() => {
    const filteredPosters = allPosters.filter((poster) => {
      const normalizedSearchTerm = normalizeText(searchTerm.toLowerCase());
      const matchesSearchTerm = normalizedSearchTerm
        ? normalizeText(poster.title.toLowerCase()).includes(
            normalizedSearchTerm
          ) ||
          poster.authors.some((author) =>
            normalizeText(author.toLowerCase()).includes(normalizedSearchTerm)
          )
        : true;
      const matchesTopic = selectedTopic
        ? poster.topic === selectedTopic
        : true;
      const matchesCategory = selectedCategory
        ? poster.category === selectedCategory
        : true;
      return matchesSearchTerm && matchesTopic && matchesCategory;
    });

    setTotalPages(Math.ceil(filteredPosters.length / itemsPerPage));
    const startIndex = (page - 1) * itemsPerPage;
    setCurrentPagePosters(
      filteredPosters.slice(startIndex, startIndex + itemsPerPage)
    );
    updateTopics(filteredPosters);
  }, [searchTerm, selectedTopic, selectedCategory, page, allPosters]);

  return (
    <PostersContext.Provider
      value={{
        posters: allPosters,
        currentPagePosters,
        searchTerm,
        setSearchTerm,
        loading,
        page,
        setPage,
        totalPages,
        selectedTopic,
        setSelectedTopic,
        selectedCategory,
        setSelectedCategory,
        topics,
        categories,
      }}
    >
      {children}
    </PostersContext.Provider>
  );
};

export const usePosters = () => {
  const context = useContext(PostersContext);
  if (context === undefined) {
    throw new Error("usePosters must be used within a PostersProvider");
  }
  return context;
};
