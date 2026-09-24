import { ReactNode } from "react";
import { Box, Container, Image, Skeleton } from "@mantine/core";
import LanguageSwitcher from "./LanguageSwitcher";
import { useBannerExpanded } from "../hooks/useBannerExpanded";

// Alto responsivo del banner (y de su placeholder), acotado según el ancho de
// pantalla en vez de height:auto puro (sin tope) — así un banner que no respete la
// relación de aspecto recomendada (~10:1) no se ve desproporcionado. 10vw/20vw son
// exactamente esa relación 10:1 en el punto medio de cada clamp, así que un banner
// bien proporcionado se ve completo sin recortes en ambos estados.
// "Expandido": primera impresión al entrar a la página, antes de cualquier interacción.
const BANNER_HEIGHT_EXPANDED = "clamp(160px, 20vw, 400px)";
// "Compacto": mientras el visitante está interactuando con la página (ver useBannerExpanded).
const BANNER_HEIGHT_COMPACT = "clamp(80px, 10vw, 200px)";
// Segundos sin interacción tras los que el banner vuelve a expandirse. Reutiliza el
// mismo valor configurado para el protector de pantalla (si el evento no lo trae,
// ej. NotFoundPage sin evento, usa este valor por defecto).
const DEFAULT_IDLE_SECONDS = 20;

export default function PublicShell({
  bannerUrl,
  backgroundUrl,
  idleSeconds = DEFAULT_IDLE_SECONDS,
  children,
}: {
  bannerUrl?: string | null;
  backgroundUrl?: string | null;
  idleSeconds?: number;
  children: ReactNode;
}) {
  const expanded = useBannerExpanded(idleSeconds);
  const bannerHeight = expanded ? BANNER_HEIGHT_EXPANDED : BANNER_HEIGHT_COMPACT;

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
          display: "flex",
          justifyContent: "center",
          borderBottom: "1px solid #eaeaea",
          // Imagen del banner tal cual, sin opacidad/blur/tintes encima; si no hay backgroundUrl
          // se deja un color de respaldo plano detrás del logo.
          ...(!backgroundUrl && { backgroundColor: "#f8f9fa" }),
        }}
      >
        {/* Alto acotado (grande al entrar, compacto tras interactuar — ver
            useBannerExpanded), ancho automático según la relación de aspecto real de
            la imagen: se ve siempre completa, sin recortar nada; si su relación de
            aspecto no llena el ancho, queda centrada con el color de fondo a los
            lados en vez de estirarse o recortarse. */}
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt="Banner"
            w="auto"
            h={bannerHeight}
            fit="contain"
            style={{ display: "block", transition: "height 300ms ease" }}
          />
        ) : (
          <Skeleton height={bannerHeight} width="100%" radius={0} style={{ transition: "height 300ms ease" }} />
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
