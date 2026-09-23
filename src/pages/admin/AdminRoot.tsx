import { Outlet } from "react-router-dom";
import { AdminAuthProvider } from "../../context/AdminAuthContext";

export default function AdminRoot() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}
