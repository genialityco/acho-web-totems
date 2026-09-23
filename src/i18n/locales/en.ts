import type es from "./es";

// El tipo `typeof es` obliga a que este archivo tenga exactamente las mismas
// claves que es.ts; si falta o sobra una, tsc lo marca como error.
const en: typeof es = {
  common: {
    previous: "Previous",
    next: "Next",
    changeLanguage: "Change language",
  },
  posterList: {
    searchPlaceholder: "Search for a poster...",
    categoriesHeading: "Categories",
    categoryViewing: "You are viewing {{name}}",
    categoryView: "View {{name}}",
    themeFilterPlaceholder: "Filter by theme",
    noResults: "No posters found.",
    authorsLabel: "Author(s):",
    viewPoster: "View poster",
    pageOf: "Page {{page}} of {{totalPages}}",
  },
  posterDetail: {
    loading: "Loading poster...",
    notFound: "Poster not found.",
    voteClosed: "Voting closed",
    voteOpen: "Vote for this poster",
    backToList: "Back to list",
    posterIframeTitle: "Poster",
    voteModalTitle: "Vote for the poster",
    idNumberLabel: "ID Number",
    idNumberPlaceholder: "Enter your ID number",
    confirmVote: "Confirm Vote",
    idNumberRequired: "Please enter an ID number.",
    voterNotFound: "We couldn't find a user with this ID number. Sign up in the App to be able to vote.",
    votingClosedError: "Voting for this event is closed.",
    alreadyVotedFor: "You have already voted for the poster: {{title}}.",
    alreadyVotedGeneric: "You have already voted for a poster.",
    voteError: "There was an error processing your vote. Please try again.",
    alreadyVotedTitle: "You've already voted!",
    thanksForParticipating: "Thank you for participating!",
    appPromo:
      "You can keep browsing the posters from the ACHO app, where you'll also find the conference program, your attendance certificate, and association news. Use the QR codes below to install it.",
    supportContact: "If you keep having trouble, contact support.",
    scanQr: "Scan either of the following QR codes to download the ACHO app:",
    voteSuccessTitle: "Vote registered successfully!",
    qrAlt1: "QR 1",
    qrAlt2: "QR 2",
  },
  eventLayout: {
    notFound: "We couldn't find this event. Check the link.",
    loadError: "We couldn't load the event. Please try again later.",
  },
  notFoundPage: {
    message: "We couldn't find this page. Enter through your event's link.",
  },
};

export default en;
