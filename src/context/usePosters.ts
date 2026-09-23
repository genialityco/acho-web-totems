import { createContext, useContext } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import type { Category } from "../services/firestore/categoryService";
import type { Paper } from "../services/firestore/paperService";

export type EventStatus = "loading" | "ready" | "not-found" | "error";

export type CategoryWithCount = Category & { count: number };

export type PostersContextType = {
  eventSlug: string;
  event: EventInfo | null;
  eventStatus: EventStatus;
  posters: Paper[];
  currentPagePosters: Paper[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
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
