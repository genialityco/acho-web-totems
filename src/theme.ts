import { createTheme } from "@mantine/core";

// Niveles extra más allá del xl por defecto de Mantine (88em/1408px), para que el
// landing público siga escalando en monitores grandes, TVs y pantallas gigantes.
export const theme = createTheme({
  breakpoints: {
    tv: "120em", // ~1920px
    giant: "160em", // ~2560px+
  },
});

// Mismos valores en em, para usarlos con useMediaQuery (los style props responsive
// de Mantine ya los resuelven solos a partir de theme.breakpoints).
export const RESPONSIVE_BREAKPOINTS_EM = {
  lg: "75em",
  xl: "88em",
  tv: "120em",
  giant: "160em",
} as const;
