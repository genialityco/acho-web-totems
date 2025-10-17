import api from "./api";

export interface Speaker {
  _id: string;
  names: string;
  description: string;
  eventId: string;
  image: string;
  location: string;
  isInternational: boolean;
}

// Obtener todos los conferencistas (speakers)
export const fetchSpeakers = async (): Promise<Speaker[]> => {
  try {
    const response = await api.get("/speakers");
    return response.data.data.items;
  } catch (error) {
    console.error("Error fetching speakers:", error);
    throw error;
  }
};

// Obtener un conferencista por ID
export const fetchSpeakerById = async (id: Partial<Speaker>) => {
  try {
    const response = await api.get(`/speakers/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching speaker with ID ${id}:`, error);
    throw error;
  }
};

// Crear un nuevo conferencista (speaker)
export const createSpeaker = async (speakerData: Partial<Speaker>) => {
  try {
    const response = await api.post("/speakers", speakerData);
    return response.data;
  } catch (error) {
    console.error("Error creating speaker:", error);
    throw error;
  }
};

// Actualizar un conferencista por ID
export const updateSpeaker = async (id: string, speakerData: Speaker) => {
  try {
    const response = await api.put(`/speakers/${id}`, speakerData);
    return response.data;
  } catch (error) {
    console.error(`Error updating speaker with ID ${id}:`, error);
    throw error;
  }
};

// Eliminar un conferencista por ID
export const deleteSpeaker = async (id: string) => {
  try {
    const response = await api.delete(`/speakers/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting speaker with ID ${id}:`, error);
    throw error;
  }
};

// Buscar conferencistas con filtros
export const searchSpeakers = async (filters: any) => {
  try {
    const response = await api.get("/speakers/search", { params: filters });
    return response.data;
  } catch (error) {
    console.error("Error searching speakers with filters:", error);
    throw error;
  }
};
