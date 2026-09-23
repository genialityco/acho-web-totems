import { ReactNode } from "react";
import { Box, Container, Image } from "@mantine/core";
import LanguageSwitcher from "./LanguageSwitcher";

const DEFAULT_BANNER_URL =
  "https://ik.imagekit.io/6cx9tc1kx/Imagenes%20App%20Prueba/LOGO_ACHO.png?updatedAt=1726756148659";

export default function PublicShell({
  bannerUrl,
  backgroundUrl,
  children,
}: {
  bannerUrl?: string | null;
  backgroundUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <Box
      style={{
        minHeight: "100vh",
        ...(backgroundUrl && {
          // Una sola capa de fondo para todo el sitio público (header + contenido),
          // no solo el contenido principal; fixed para que cubra el 100% del viewport
          // sin desplazarse con el scroll.
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        }),
      }}
    >
      <Box
        style={{
          position: "relative",
          width: "100%",
          borderBottom: "1px solid #eaeaea",
          // Imagen del banner tal cual, sin opacidad/blur/tintes encima; si no hay backgroundUrl
          // se deja un color de respaldo plano detrás del logo.
          ...(!backgroundUrl && { backgroundColor: "#f8f9fa" }),
        }}
      >
        {/* Ancho 100%, alto automático según la relación de aspecto real de la imagen:
            se ve completa siempre, sin recortes, el alto se adapta a cada banner. */}
        <Image src={bannerUrl || DEFAULT_BANNER_URL} alt="Banner" w="100%" h="auto" style={{ display: "block" }} />
        <Box style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)" }}>
          <LanguageSwitcher />
        </Box>
      </Box>

      <Container fluid mt="md">
        {children}
      </Container>
    </Box>
  );
}
