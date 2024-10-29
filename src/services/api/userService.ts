import api from './api';

interface User {
  _id: string;
  firebaseUid: string;
  expoPushToken: string | null;
}

// Obtener todos los usuarios (users)
export const fetchUsers = async () => {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Obtener un usuario por ID
export const fetchUserById = async (id: string) => {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching user with ID ${id}:`, error);
    throw error;
  }
};

// Crear un nuevo usuario (user)
export const createUser = async (userData: Partial<User>) => {
  try {
    const response = await api.post('/users', userData);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Actualizar un usuario por ID
export const updateUser = async (id: string, userData: Partial<User>) => {
  try {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  } catch (error) {
    console.error(`Error updating user with ID ${id}:`, error);
    throw error;
  }
};

// Eliminar un usuario por ID
export const deleteUser = async (id: string) => {
  try {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting user with ID ${id}:`, error);
    throw error;
  }
};

// Buscar usuarios con filtros
export const searchUsers = async (filters: unknown) => {
  try {
    const response = await api.get('/users/search', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error searching users with filters:', error);
    throw error;
  }
};

// Actualizar o guardar expoPushToken
export const updateExpoPushToken = async (userId: unknown, expoPushToken: unknown) => {
  try {
    await api.post('/users/updatePushToken', {
      userId,
      expoPushToken,
    });
    console.log('Expo push token actualizado exitosamente');
  } catch (error) {
    console.error('Error al actualizar el expo push token:', error);
  }
};
