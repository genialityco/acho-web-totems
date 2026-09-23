import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { theme } from "./theme";
import HomePage from "./pages/HomePage";
import PosterDetail from "./components/PosterDetail";
import EventLayout from "./pages/EventLayout";
import NotFoundPage from "./pages/NotFoundPage";
import AdminRoot from "./pages/admin/AdminRoot";
import AdminLogin from "./pages/admin/AdminLogin";
import ProtectedAdminRoute from "./pages/admin/ProtectedAdminRoute";
import AdminEventsPage from "./pages/admin/AdminEventsPage";
import AdminEventLayout from "./pages/admin/AdminEventLayout";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminPapers from "./pages/admin/AdminPapers";
import AdminVoters from "./pages/admin/AdminVoters";
import AdminResults from "./pages/admin/AdminResults";
import AdminScreensaver from "./pages/admin/AdminScreensaver";
import PapersBulkUpload from "./components/admin/PapersBulkUpload";
import VotersBulkUpload from "./components/admin/VotersBulkUpload";

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminRoot />}>
            <Route path="login" element={<AdminLogin />} />
            <Route element={<ProtectedAdminRoute />}>
              <Route index element={<AdminEventsPage />} />
              <Route path=":eventSlug" element={<AdminEventLayout />}>
                <Route index element={<Navigate to="categories" replace />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="papers" element={<AdminPapers />} />
                <Route path="papers/bulk-upload" element={<PapersBulkUpload />} />
                <Route path="voters" element={<AdminVoters />} />
                <Route path="voters/bulk-upload" element={<VotersBulkUpload />} />
                <Route path="results" element={<AdminResults />} />
                <Route path="screensaver" element={<AdminScreensaver />} />
              </Route>
            </Route>
          </Route>
          <Route path="/:eventSlug" element={<EventLayout />}>
            <Route index element={<HomePage />} />
            <Route path="paper/:id" element={<PosterDetail />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
