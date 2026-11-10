import { ReactNode } from "react";
import { Mark } from "@mantine/core";
import { findWordRanges } from "../utils/text";

// Muestra `text` marcando cada palabra significativa de `term` (sin distinguir mayúsculas ni tildes,
// igual que la búsqueda exacta, que en título y autores coincide por palabras). Sin término o sin
// coincidencias, devuelve el texto tal cual.
export const HighlightedText = ({ text, term }: { text: string; term: string }) => {
  const ranges = findWordRanges(text, term);
  if (ranges.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    // Dos coincidencias pueden compartir un carácter original si plegar lo expandió.
    const from = Math.max(start, cursor);
    if (from >= end) return;
    if (from > cursor) parts.push(text.slice(cursor, from));
    parts.push(<Mark key={i}>{text.slice(from, end)}</Mark>);
    cursor = end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
};
