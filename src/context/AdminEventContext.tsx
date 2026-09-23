import React, { useEffect, useState } from "react";
import { subscribeEvent, EventInfo } from "../services/firestore/eventService";
import { subscribeCategories, Category } from "../services/firestore/categoryService";
import { subscribePapers, Paper } from "../services/firestore/paperService";
import { subscribeVoters, Voter } from "../services/firestore/voterService";
import { subscribeVotes, VoteRecord } from "../services/firestore/voteService";
import { AdminEventContext, AdminEventStatus } from "./useAdminEvent";

export const AdminEventProvider: React.FC<{
  eventSlug: string;
  children: React.ReactNode;
}> = ({ eventSlug, children }) => {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loaded, setLoaded] = useState({
    event: false,
    categories: false,
    papers: false,
    voters: false,
    votes: false,
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const markLoaded = (key: keyof typeof loaded) =>
      setLoaded((prev) => ({ ...prev, [key]: true }));
    const fail = (error: Error) => {
      console.error("Error al cargar el evento:", error);
      setFailed(true);
    };
    const unsubscribers = [
      subscribeEvent(eventSlug, (info) => { setEvent(info); markLoaded("event"); }, fail),
      subscribeCategories(eventSlug, (list) => { setCategories(list); markLoaded("categories"); }, fail),
      subscribePapers(eventSlug, (list) => { setPapers(list); markLoaded("papers"); }, fail),
      subscribeVoters(eventSlug, (list) => { setVoters(list); markLoaded("voters"); }, fail),
      subscribeVotes(eventSlug, (list) => { setVotes(list); markLoaded("votes"); }, fail),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [eventSlug]);

  const status: AdminEventStatus = failed
    ? "error"
    : !Object.values(loaded).every(Boolean)
    ? "loading"
    : event
    ? "ready"
    : "not-found";

  return (
    <AdminEventContext.Provider
      value={{ eventSlug, status, event, categories, papers, voters, votes }}
    >
      {children}
    </AdminEventContext.Provider>
  );
};
