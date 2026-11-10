import { useMediaQuery } from "@mantine/hooks";

// Tótem táctil vertical (ej. 50" a 1080x1920): se usa de pie, a un brazo de distancia y con el dedo.
// Por orientación + alto, para no depender de que el navegador esté en pantalla completa (sin ella el
// alto útil baja de 1920); celulares y tabletas verticales no llegan a 1600px de alto.
export const TOTEM_MEDIA_QUERY = "(orientation: portrait) and (min-height: 100em)";

// useMediaQuery da undefined en el primer render (lo resuelve en un efecto): se toma como "no tótem".
export const useIsTotem = (): boolean => useMediaQuery(TOTEM_MEDIA_QUERY) ?? false;
