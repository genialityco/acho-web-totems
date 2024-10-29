import "@mantine/core/styles.css";
import { MantineProvider, Container, Box, Image } from "@mantine/core";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { theme } from "./theme";
import HomePage from "./pages/HomePage";
import PosterDetail from "./components/PosterDetail";

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <Box>
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0.5rem 1rem",
              borderBottom: "1px solid #eaeaea",
              backgroundColor: "#f8f9fa",
            }}
          >
            <Box
              style={{
                width: "100%",
                height: 80,
                marginBlock: "10px",
                overflow: "hidden",
              }}
            >
              <Image
                src="https://ik.imagekit.io/6cx9tc1kx/Imagenes%20App%20Prueba/LOGO_ACHO.png?updatedAt=1726756148659"
                alt="Logo"
                fit="contain"
                height={80}
              />
            </Box>
          </Box>

          {/* Contenedor con padding */}
          <Container fluid mt="md">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/poster/:id" element={<PosterDetail />} />
            </Routes>
          </Container>
        </Box>
      </BrowserRouter>
    </MantineProvider>
  );
}
