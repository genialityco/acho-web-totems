import { createContext, useContext } from "react";
import type { EventInfo } from "../services/firestore/eventService";
import type { Category } from "../services/firestore/categoryService";
import type { Paper } from "../services/firestore/paperService";
import type { Voter } from "../services/firestore/voterService";
import type { VoteRecord } from "../services/firestore/voteService";
import type { ScreensaverItem } from "../services/firestore/screensaverService";

export type AdminEventStatus = "loading" | "ready" | "not-found" | "error";

export type AdminEventContextType = {
  eventSlug: string;
  status: AdminEventStatus;
  event: EventInfo | null;
  categories: Category[];
  papers: Paper[];
  voters: Voter[];
  votes: VoteRecord[];
  screensaverItems: ScreensaverItem[];
};

export const AdminEventContext = createContext<AdminEventContextType | undefined>(undefined);

export const useAdminEvent = () => {
  const context = useContext(AdminEventContext);
  if (context === undefined) {
    throw new Error("useAdminEvent must be used within an AdminEventProvider");
  }
  return context;
};
