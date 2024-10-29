import { SetStateAction } from "react";
import api from "./api";

// Interfaz para Posters
export interface Poster {
  status: string;
  data: SetStateAction<Poster | null>;
  _id: string;
  title: string;
  category: string;
  topic: string;
  institution: string;
  authors: string[];
  votes: number;
  urlPdf: string;
  eventId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Obtener todos los posters
export const fetchPosters = async (): Promise<Poster[]> => {
  try {
    const response = await api.get("/posters");
    return response.data as Poster[];
  } catch (error) {
    console.error("Error al obtener los posters:", error);
    throw error;
  }
};

// Obtener un poster por ID
export const fetchPosterById = async (id: string): Promise<Poster> => {
  try {
    const response = await api.get(`/posters/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener el poster con ID ${id}:`, error);
    throw error;
  }
};

// Crear un nuevo poster
export const createPoster = async (
  posterData: Omit<Poster, "_id" | "createdAt" | "updatedAt">
): Promise<Poster> => {
  try {
    const response = await api.post("/posters", posterData);
    return response.data as Poster; // Typecasting de la respuesta a un poster
  } catch (error) {
    console.error("Error al crear el poster:", error);
    throw error;
  }
};

// Actualizar un poster por ID
export const updatePoster = async (
  id: string,
  posterData: Partial<Poster>
): Promise<Poster> => {
  try {
    const response = await api.put(`/posters/${id}`, posterData);
    return response.data as Poster;
  } catch (error) {
    console.error(`Error al actualizar el poster con ID ${id}:`, error);
    throw error;
  }
};

// Eliminar un poster por ID
export const deletePoster = async (id: string): Promise<void> => {
  try {
    const response = await api.delete(`/posters/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error al eliminar el poster con ID ${id}:`, error);
    throw error;
  }
};

// Buscar posters con filtros
export const searchPosters = async (filters: unknown): Promise<unknown> => {
  try {
    const response = await api.get("/posters/search", { params: filters });
    return response.data;
  } catch (error) {
    console.error("Error al buscar posters con filtros:", error);
    throw error;
  }
};

// Votar por un poster
export const voteForPoster = async (
  posterId: string,
  userId: string
): Promise<Poster> => {
  try {
    const response = await api.post(`/posters/${posterId}/vote`, { userId });
    return response.data as Poster;
  } catch (error) {
    console.error(`Error al votar por el poster con ID ${posterId}:`, error);
    throw error;
  }
};
