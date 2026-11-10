import { useEffect, useState } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import { getNextVotingChange, getVotingPhase } from "../utils/votingSchedule";

// Fase de votación del evento en vivo: con una apertura o un cierre por delante re-renderiza cada
// segundo (para los contadores) y así la página cambia de fase sola, sin recargar.
export const useVotingPhase = (event: EventInfo | null) => {
  const [now, setNow] = useState(() => Date.now());
  const nextChange = event ? getNextVotingChange(event, now) : null;
  const ticking = nextChange !== null;

  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  return {
    now,
    phase: event ? getVotingPhase(event, now) : null,
    nextChange,
  };
};
