import { Center, Loader } from "@mantine/core";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import AdminShell from "../../components/admin/AdminShell";
import { useAdminAuth } from "../../context/useAdminAuth";

export default function ProtectedAdminRoute() {
  const { user, isAdmin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }
  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
