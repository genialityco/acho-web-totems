import api from './api';

interface Member {
  _id: string;
  userId: string;
  organizationId: string;
  properties: Record<string, unknown>; // Puede ser un objeto con propiedades dinámicas
}

// Obtener todos los miembros (members)
export const fetchMembers = async () => {
  try {
    const response = await api.get('/members');
    return response.data;
  } catch (error) {
    console.error('Error fetching members:', error);
    throw error;
  }
};

// Obtener un miembro por ID
export const fetchMemberById = async (id: string) => {
  try {
    const response = await api.get(`/members/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching member with ID ${id}:`, error);
    throw error;
  }
};

// Crear un nuevo miembro (member)
export const createMember = async (memberData: Partial<Member>) => {
  try {
    const response = await api.post('/members', memberData);
    return response.data;
  } catch (error) {
    console.error('Error creating member:', error);
    throw error;
  }
};

// Actualizar un miembro por ID
export const updateMember = async (id: string, memberData: Partial<Member>) => {
  try {
    const response = await api.put(`/members/${id}`, memberData);
    return response.data;
  } catch (error) {
    console.error(`Error updating member with ID ${id}:`, error);
    throw error;
  }
};

// Eliminar un miembro por ID
export const deleteMember = async (id: string) => {
  try {
    const response = await api.delete(`/members/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting member with ID ${id}:`, error);
    throw error;
  }
};

// Buscar miembros con filtros
export const searchMembers = async (filters: unknown) => {
  try {
    const response = await api.get('/members/search', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error searching members with filters:', error);
    throw error;
  }
};
