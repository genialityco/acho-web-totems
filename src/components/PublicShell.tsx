import { ReactNode } from "react";
import { Box, Container, Image, Skeleton } from "@mantine/core";
import LanguageSwitcher from "./LanguageSwitcher";
import { useBannerExpanded } from "../hooks/useBannerExpanded";
import type { PublicStyle } from "../services/firestore/eventService";
import "./PublicGlass.css";

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
// Velo oscuro sobre la imagen de fondo del evento en el estilo "glass": la imagen se sigue viendo,
// pero las superficies traslúcidas y el texto claro se leen encima. Moderado a propósito: con 74–80% la
// imagen casi desaparecía; las tarjetas y paneles ya son oscuros, así que no hace falta más.
const GLASS_VEIL = "linear-gradient(rgba(8, 10, 14, 0.4), rgba(8, 10, 14, 0.5))";
const GLASS_FALLBACK_BACKGROUND = "#0b0f14";

export default function PublicShell({
  bannerUrl,
  backgroundUrl,
  idleSeconds = DEFAULT_IDLE_SECONDS,
  publicStyle = "classic",
  topLeft,
  backgroundLayer,
  children,
}: {
  bannerUrl?: string | null;
  backgroundUrl?: string | null;
  idleSeconds?: number;
  // Estilo del evento (ver PublicGlass.css); sin evento (NotFoundPage) se usa el clásico.
  publicStyle?: PublicStyle;
  // Contenido opcional arriba a la izquierda del encabezado (ej. el botón del QR de la app).
  topLeft?: ReactNode;
  // Capa animada entre la imagen de fondo y el contenido (ej. la esfera de la pared de tótems); fija y sin
  // eventos de puntero. El encabezado y el contenido van por encima (zIndex 1).
  backgroundLayer?: ReactNode;
  children: ReactNode;
}) {
  const expanded = useBannerExpanded(idleSeconds);
  const bannerHeight = expanded ? BANNER_HEIGHT_EXPANDED : BANNER_HEIGHT_COMPACT;
  const glass = publicStyle === "glass";

  return (
    <Box
      className={glass ? "gpGlass" : undefined}
      // Activa las reglas oscuras de Mantine solo dentro del sitio público (ver PublicGlass.css).
      data-mantine-color-scheme={glass ? "dark" : undefined}
      style={{
        minHeight: "100vh",
        // Color oscuro de base también debajo de la imagen: mientras carga no se ve el velo sobre blanco (gris).
        ...(glass && { backgroundColor: GLASS_FALLBACK_BACKGROUND }),
        ...(backgroundUrl && {
          // Una sola capa de fondo para todo el sitio público (header + contenido),
          // no solo el contenido principal; fixed para que cubra el 100% del viewport
          // sin desplazarse con el scroll.
          backgroundImage: glass ? `${GLASS_VEIL}, url(${backgroundUrl})` : `url(${backgroundUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        }),
      }}
    >
      {backgroundLayer}
      <Box
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          borderBottom: glass ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #eaeaea",
          // Imagen del banner tal cual, sin opacidad/blur/tintes encima; si no hay backgroundUrl
          // se deja un color de respaldo plano detrás del logo. En "glass", una franja oscura
          // traslúcida detrás del banner (el banner en sí no se toca).
          ...(glass
            ? { backgroundColor: "rgba(8, 10, 14, 0.45)" }
            : !backgroundUrl && { backgroundColor: "#f8f9fa" }),
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
        {/* Logo Geniality (SVG transparente con texto blanco): va sobre un chip oscuro
            para que se lea sin importar los colores del banner. */}
        <Box
          style={{
            position: "absolute",
            top: 8,
            right: 12,
            padding: "4px 10px",
            borderRadius: 8,
            backgroundColor: "rgba(19, 56, 81, 0.92)",
            lineHeight: 0,
          }}
        >
          <Image src="/logo-geniality.svg" alt="Geniality" h={28} w="auto" fit="contain" />
        </Box>
        <Box style={{ position: "absolute", bottom: 8, right: 12 }}>
          <LanguageSwitcher />
        </Box>
        {topLeft && <Box style={{ position: "absolute", top: 6, left: 8 }}>{topLeft}</Box>}
      </Box>

      <Container fluid mt="md" style={{ position: "relative", zIndex: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
