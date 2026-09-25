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
    searchModeExact: "Exact",
    searchModeSemantic: "Conceptual",
    searchModeBoth: "Both",
    searchModeCaption: {
      exact: "Finds exact matches in title, authors, and the document's text.",
      semantic: "Finds posters by meaning, even without the document's exact words.",
      both: "Combines exact and meaning-based results.",
    },
    categoriesHeading: "Categories",
    categoryViewing: "You are viewing {{name}}",
    categoryView: "View {{name}}",
    themeFilterPlaceholder: "Filter by theme",
    noResults: "No posters found.",
    resultsCount: "Results: {{shown}} of {{total}}",
    matchInDocument: "In the document:",
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
    download: "Download",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    voteModalTitle: "Vote for the poster",
    idNumberLabel: "ID Number",
    idNumberPlaceholder: "Enter your ID number",
    confirmVote: "Confirm Vote",
    idNumberRequired: "Please enter an ID number.",
    voterNotFound: "We couldn't find a user with this ID number.",
    votingClosedError: "Voting for this event is closed.",
    alreadyVotedFor: "You have already voted for the poster: {{title}}.",
    alreadyVotedGeneric: "You have already voted for a poster.",
    voteError: "There was an error processing your vote. Please try again.",
    alreadyVotedTitle: "You've already voted!",
    thanksForParticipating: "Thank you for participating!",
    voteSuccessTitle: "Vote registered successfully!",
  },
  eventLayout: {
    notFound: "We couldn't find this event. Check the link.",
    loadError: "We couldn't load the event. Please try again later.",
  },
  notFoundPage: {
    message: "We couldn't find this page. Enter through your event's link.",
  },
  screensaver: {
    tapToContinue: "Tap to continue",
  },
};

export default en;
