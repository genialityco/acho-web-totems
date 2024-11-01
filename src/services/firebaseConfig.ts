import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, set, get } from "firebase/database";
import { getAuth } from "firebase/auth"; // Importa getAuth en lugar de initializeAuth

// Configuración de Firebase obtenida desde Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyC6QR5gKslC8JqrZTG8xJq4Kafdz0tnq6U",
  authDomain: "global-auth-49737.firebaseapp.com",
  databaseURL: "https://global-auth-49737-default-rtdb.firebaseio.com",
  projectId: "global-auth-49737",
  storageBucket: "global-auth-49737.appspot.com",
  messagingSenderId: "818786178354",
  appId: "1:818786178354:web:d3b43d220141ab4b55b32b",
  measurementId: "G-3741K6QH0J",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Obtener la base de datos
const db = getDatabase(app);

// Inicializar autenticación sin persistencia
export const auth = getAuth(app); // Cambia initializeAuth por getAuth

export { db, ref, push, onValue, set, get };
