import { Center, Loader, Text } from "@mantine/core";
import { Outlet, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicShell from "../components/PublicShell";
import ScreensaverManualTrigger from "../components/ScreensaverManualTrigger";
import ScreensaverOverlay from "../components/ScreensaverOverlay";
import TouchKeyboard from "../components/TouchKeyboard";
import { useIsTotem } from "../hooks/useIsTotem";
import { PostersProvider } from "../context/PostersContext";
import { usePosters } from "../context/usePosters";

function EventGate() {
  const { t } = useTranslation();
  const { eventStatus, event, screensaverItems } = usePosters();
  const isTotem = useIsTotem();

  let content;
  if (eventStatus === "loading") {
    content = (
      <Center h="50vh">
        <Loader size="lg" />
      </Center>
    );
  } else if (eventStatus === "not-found") {
    content = (
      <Center h="50vh">
        <Text size="lg" ta="center">
          {t("eventLayout.notFound")}
        </Text>
      </Center>
    );
  } else if (eventStatus === "error") {
    content = (
      <Center h="50vh">
        <Text size="lg" ta="center">
          {t("eventLayout.loadError")}
        </Text>
      </Center>
    );
  } else {
    content = <Outlet />;
  }

  return (
    <>
      <PublicShell
        bannerUrl={event?.bannerUrl}
        backgroundUrl={event?.backgroundUrl}
        idleSeconds={event?.screensaverIdleSeconds}
        // "glass" por defecto, también mientras carga el evento.
        publicStyle={event?.publicStyle ?? "glass"}
      >
        {content}
      </PublicShell>
      {/* Teclado en pantalla para los campos de texto en los tótems (ver TouchKeyboard); el admin puede
          desactivarlo por evento, y entonces los campos se comportan como en cualquier navegador. */}
      {isTotem && event?.touchKeyboardEnabled !== false && <TouchKeyboard dark={event?.publicStyle !== "classic"} />}
      {eventStatus === "ready" && event?.screensaverEnabled && screensaverItems.length > 0 && (
        <>
          <ScreensaverOverlay
            items={screensaverItems}
            idleSeconds={event.screensaverIdleSeconds}
            photoDurationSeconds={event.screensaverPhotoDurationSeconds}
          />
          <ScreensaverManualTrigger />
        </>
      )}
    </>
  );
}

export default function EventLayout() {
  const { eventSlug = "" } = useParams<{ eventSlug: string }>();

  // key reinicia el estado del provider al cambiar de evento
  return (
    <PostersProvider key={eventSlug} eventSlug={eventSlug}>
      <EventGate />
    </PostersProvider>
  );
}
