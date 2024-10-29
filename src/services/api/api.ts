import axios from 'axios';

// Crea la instancia de Axios
// https://lobster-app-uy9hx.ondigitalocean.app api
// http://192.168.0.16:3000 local red
// http://localhost:3000 local

const api = axios.create({
  baseURL: 'https://lobster-app-uy9hx.ondigitalocean.app',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de solicitudes
api.interceptors.request.use(
  (config) => {
    // Lógica antes de que se envíe la solicitud
    return config;
  },
  (error) => {
    // Manejo de error antes de que la solicitud se envíe
    return Promise.reject(error);
  }
);

// Interceptor de respuestas
api.interceptors.response.use(
  (response) => {
    // Cualquier procesamiento antes de devolver la respuesta
    return response;
  },
  (error) => {
    // Manejo de errores global
    console.error('Error en la respuesta:', error);
    return Promise.reject(error);
  }
);

export default api;
