import React, { createContext, useContext, useState, useEffect } from "react";
import { searchPosters, Poster } from "../services/api/posterService";
import debounce from "lodash.debounce";

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
  const [posters, setPosters] = useState<Poster[]>([]);
  const [currentPagePosters, setCurrentPagePosters] = useState<Poster[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [topics, setTopics] = useState<
    { topic: string; count: number; color: string }[]
  >([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Debounce para el término de búsqueda
  useEffect(() => {
    const handler = debounce(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    handler();
    return () => handler.cancel();
  }, [searchTerm]);

  const fetchFilteredPosters = async () => {
    setLoading(true);
    try {
      const filters = {
        search: debouncedSearchTerm,
        topic: selectedTopic,
        category: selectedCategory,
        page: 1,
        limit: 300,
      };
      const response = (await searchPosters(filters)) as {
        status: string;
        data: { items: Poster[] };
      };

      if (response.status === "success") {
        setPosters(response.data.items);
        setTotalPages(Math.ceil(response.data.items.length / itemsPerPage));

        const topicCounts = response.data.items.reduce(
          (acc: { [key: string]: number }, poster) => {
            if (poster.topic) {
              acc[poster.topic] = (acc[poster.topic] || 0) + 1;
            }
            return acc;
          },
          {}
        );
        setTopics([
          ...topics,
          ...Object.keys(topicCounts)
            .filter((topic) => !topics.some((t) => t.topic === topic))
            .map((topic) => ({
              topic,
              count: topicCounts[topic],
              color: determineColor(topic),
            })),
        ]);

        setCategories(
          [
            ...new Set([
              ...categories,
              ...response.data.items.map((poster) => poster.category),
            ]),
          ].filter(Boolean)
        );
      } else {
        setPosters([]);
        setTotalPages(1);
      }
    } catch (error) {
      setPosters([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const determineColor = (topic: string) => {
    switch (topic) {
      case "Categoría Especial":
        return "green";
      case "Estudios Analíticos":
        return "purple";
      case "Estudios Descriptivos":
        return "blue";
      case "Reporte de Casos":
        return "red";
      default:
        return "gray";
    }
  };

  useEffect(() => {
    fetchFilteredPosters();
  }, [debouncedSearchTerm, selectedTopic, selectedCategory]);

  useEffect(() => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setCurrentPagePosters(posters.slice(startIndex, endIndex));
  }, [page, posters]);

  return (
    <PostersContext.Provider
      value={{
        posters,
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
