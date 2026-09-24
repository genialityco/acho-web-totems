import { Center, Loader, Text } from "@mantine/core";
import { Outlet, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicShell from "../components/PublicShell";
import ScreensaverOverlay from "../components/ScreensaverOverlay";
import { PostersProvider } from "../context/PostersContext";
import { usePosters } from "../context/usePosters";

function EventGate() {
  const { t } = useTranslation();
  const { eventStatus, event, screensaverItems } = usePosters();

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
      >
        {content}
      </PublicShell>
      {eventStatus === "ready" && event?.screensaverEnabled && screensaverItems.length > 0 && (
        <ScreensaverOverlay
          items={screensaverItems}
          idleSeconds={event.screensaverIdleSeconds}
          photoDurationSeconds={event.screensaverPhotoDurationSeconds}
        />
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
