// Sin `as const`: solo interesa que en.ts tenga las mismas claves, con valores string.
const es = {
  common: {
    previous: "Anterior",
    next: "Siguiente",
    changeLanguage: "Cambiar idioma",
  },
  posterList: {
    searchPlaceholder: "Buscar un póster...",
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
    voterNotFound: "No se encontró un usuario con esta cédula. Regístrate en la App para poder votar.",
    votingClosedError: "La votación para este evento está cerrada.",
    alreadyVotedFor: "Ya has votado por el póster: {{title}}.",
    alreadyVotedGeneric: "Ya has votado por un póster.",
    voteError: "Hubo un error al procesar tu voto. Intenta de nuevo.",
    alreadyVotedTitle: "¡Ya has votado!",
    thanksForParticipating: "¡Gracias por tu participación!",
    appPromo:
      "Puedes seguir viendo los posters desde la aplicación de la ACHO, donde también encontrarás el programa del congreso, tu certificado de asistencia y novedades de la asociación. Usa los siguientes QR para instalarla.",
    supportContact: "Si sigues teniendo dificultades comunicate con soporte.",
    scanQr: "Escanea cualquiera de los siguientes códigos QR para descargar la aplicación de ACHO:",
    voteSuccessTitle: "¡Voto registrado exitosamente!",
    qrAlt1: "QR 1",
    qrAlt2: "QR 2",
  },
  eventLayout: {
    notFound: "No encontramos este evento. Verifica el enlace.",
    loadError: "No pudimos cargar el evento. Intenta de nuevo más tarde.",
  },
  notFoundPage: {
    message: "No encontramos esta página. Ingresa desde el enlace de tu evento.",
  },
};

export default es;
