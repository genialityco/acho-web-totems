import { ReactNode } from "react";
import { Mark } from "@mantine/core";
import { findMatchRanges } from "../utils/text";

// Muestra `text` marcando las coincidencias de `term` (sin distinguir mayúsculas ni tildes,
// igual que la búsqueda exacta). Sin término o sin coincidencias, devuelve el texto tal cual.
export const HighlightedText = ({ text, term }: { text: string; term: string }) => {
  const ranges = findMatchRanges(text, term);
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
