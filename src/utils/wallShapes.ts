// Figuras del fondo animado de la pared de tótems (WallSphere / wallFigures).
export type WallShape = "sphere" | "platelet" | "cancerCell" | "image";

export const WALL_SHAPES: readonly WallShape[] = ["sphere", "platelet", "cancerCell", "image"];

// Color por defecto de cada figura (el admin lo puede cambiar).
export const WALL_SHAPE_DEFAULT_COLORS: Record<Exclude<WallShape, "image">, string> = {
  sphere: "#3bc9db",
  platelet: "#b3121b",
  cancerCell: "#b03a8f",
};
