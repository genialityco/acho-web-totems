import { Center, Loader, Text } from "@mantine/core";
import { Outlet, useMatch, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicShell from "../components/PublicShell";
import AppQrButton from "../components/AppQrButton";
import WallSphere from "../components/WallSphere";
import { useWallPosition } from "../hooks/useWallPosition";
import { useIdleTimer } from "../hooks/useIdleTimer";
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
  const wall = useWallPosition();
  // Mientras se ve el protector de pantalla (mismo temporizador que el protector), la figura de la pared se
  // dibuja por encima de él, para que también se vea sobre sus fotos/videos; si el evento lo desactiva
  // (wallEffectOverScreensaver), se desmonta mientras dure el protector.
  // Mientras se ve un póster el protector no se activa (ni por inactividad ni con el activador manual):
  // alguien puede estar leyéndolo sin tocar la pantalla. Al volver a la lista, el conteo empieza de cero.
  const viewingPoster = useMatch("/:eventSlug/paper/:id") !== null;
  const screensaverActive =
    eventStatus === "ready" && !!event?.screensaverEnabled && screensaverItems.length > 0 && !viewingPoster;
  const screensaverShowing = useIdleTimer(event?.screensaverIdleSeconds ?? 120, screensaverActive);
  const showWallSphere =
    eventStatus === "ready" &&
    !!event?.wallEffectEnabled &&
    wall.position !== null &&
    (!screensaverShowing || event.wallEffectOverScreensaver) &&
    // "Imagen propia" sin imagen subida: no hay nada que mostrar.
    (event.wallEffectShape !== "image" || !!event.wallEffectImageUrl);

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
        backgroundLayer={
          showWallSphere && event && wall.position !== null ? (
            <WallSphere
              position={wall.position}
              screens={event.wallScreens}
              gapsCm={event.wallGapsCm}
              color={event.wallEffectColor}
              shape={event.wallEffectShape}
              imageUrl={event.wallEffectImageUrl}
              calibrate={wall.calibrate}
              showFps={wall.showFps}
              aboveScreensaver={screensaverShowing}
            />
          ) : undefined
        }
        topLeft={
          event && (event.appAndroidUrl || event.appIosUrl) ? (
            <AppQrButton eventSlug={event.slug} idleSeconds={event.screensaverIdleSeconds} />
          ) : undefined
        }
      >
        {content}
      </PublicShell>
      {/* Teclado en pantalla para los campos de texto en los tótems (ver TouchKeyboard); el admin puede
          desactivarlo por evento, y entonces los campos se comportan como en cualquier navegador. */}
      {isTotem && event?.touchKeyboardEnabled !== false && <TouchKeyboard dark={event?.publicStyle !== "classic"} />}
      {screensaverActive && event && (
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
