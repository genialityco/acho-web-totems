// Sin `as const`: solo interesa que en.ts tenga las mismas claves, con valores string.
const es = {
  common: {
    previous: "Anterior",
    next: "Siguiente",
    changeLanguage: "Cambiar idioma",
  },
  posterList: {
    searchPlaceholder: "Buscar un póster...",
    searchModeExact: "Exacta",
    searchModeSemantic: "Conceptual",
    searchModeBoth: "Ambas",
    searchModeCaption: {
      exact: "Busca coincidencias exactas en título, autores y el texto del documento.",
      semantic: "Busca por significado, aunque no uses las palabras exactas del documento.",
      both: "Combina resultados exactos y por significado.",
    },
    categoriesHeading: "Categorías",
    categoryViewing: "Estas viendo {{name}}",
    categoryView: "Ver {{name}}",
    themeFilterPlaceholder: "Filtrar por tema",
    noResults: "No se encontraron pósters.",
    authorsLabel: "Autor(es):",
    viewPoster: "Ver póster",
    pageOf: "Página {{page}} de {{totalPages}}",
  },
  posterDetail: {
    loading: "Cargando póster...",
    notFound: "No se encontró el póster.",
    voteClosed: "Votación cerrada",
    voteOpen: "Votar por este póster",
    backToList: "Volver a la lista",
    posterIframeTitle: "Póster",
    voteModalTitle: "Votar por el póster",
    idNumberLabel: "Número de Cédula",
    idNumberPlaceholder: "Ingresa tu número de cédula",
    confirmVote: "Confirmar Voto",
    idNumberRequired: "Por favor, ingresa un número de cédula.",
    voterNotFound: "No se encontró un usuario con esta cédula.",
    votingClosedError: "La votación para este evento está cerrada.",
    alreadyVotedFor: "Ya has votado por el póster: {{title}}.",
    alreadyVotedGeneric: "Ya has votado por un póster.",
    voteError: "Hubo un error al procesar tu voto. Intenta de nuevo.",
    alreadyVotedTitle: "¡Ya has votado!",
    thanksForParticipating: "¡Gracias por tu participación!",
    voteSuccessTitle: "¡Voto registrado exitosamente!",
  },
  eventLayout: {
    notFound: "No encontramos este evento. Verifica el enlace.",
    loadError: "No pudimos cargar el evento. Intenta de nuevo más tarde.",
  },
  notFoundPage: {
    message: "No encontramos esta página. Ingresa desde el enlace de tu evento.",
  },
  screensaver: {
    tapToContinue: "Toca para continuar",
  },
};

export default es;
