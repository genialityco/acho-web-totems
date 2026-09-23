import React, { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { checkIsAdmin } from "../services/firestore/adminService";
import { AdminAuthContext } from "./useAdminAuth";

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      if (!current) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      let admin = false;
      try {
        admin = await checkIsAdmin(current.uid);
      } catch (error) {
        console.error("No se pudo verificar el rol de administrador:", error);
      }
      // Ignora la respuesta si mientras tanto cambió la sesión.
      if (auth.currentUser?.uid === current.uid) {
        setIsAdmin(admin);
        setLoading(false);
      }
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  return (
    <AdminAuthContext.Provider
      value={{ user, isAdmin, loading, signIn, signOut: () => firebaseSignOut(auth) }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};
