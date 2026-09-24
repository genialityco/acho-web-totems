import { ReactNode } from "react";
import { Box, Container, Image, Skeleton } from "@mantine/core";
import LanguageSwitcher from "./LanguageSwitcher";

// Alto fijo del placeholder cuando el evento no tiene bannerUrl propio (no hay
// imagen de referencia de la que derivar un alto automático, a diferencia del
// banner real que usa h="auto" según su relación de aspecto).
const BANNER_SKELETON_HEIGHT = 120;

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
        {bannerUrl ? (
          <Image src={bannerUrl} alt="Banner" w="100%" h="auto" style={{ display: "block" }} />
        ) : (
          <Skeleton height={BANNER_SKELETON_HEIGHT} width="100%" radius={0} />
        )}
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
