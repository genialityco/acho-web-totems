import { useEffect, useMemo } from "react";
import { Button, Card, Center, Loader, Stack, Text } from "@mantine/core";
import { IconBrandApple, IconBrandGooglePlay } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { usePosters } from "../context/usePosters";
import { detectAppPlatform } from "../utils/appPlatform";
import { trackEvent } from "../services/analytics";

// /<evento>/app: destino del QR de la app (AppQrButton). En un celular Android abre Google Play y en un
// iPhone/iPad la App Store; en cualquier otro caso (computador, o si falta el enlace de esa tienda)
// muestra los botones de las tiendas configuradas.
export default function AppRedirectPage() {
  const { t } = useTranslation();
  const { event, eventSlug, eventStatus } = usePosters();
  const platform = useMemo(detectAppPlatform, []);
  const android = event?.appAndroidUrl ?? null;
  const ios = event?.appIosUrl ?? null;
  const target = platform === "android" ? android : platform === "ios" ? ios : null;

  useEffect(() => {
    if (eventStatus !== "ready") return;
    trackEvent("app_link_opened", { event_slug: eventSlug, platform, redirected: !!target });
    if (target) window.location.replace(target);
  }, [eventStatus, eventSlug, platform, target]);

  if (eventStatus !== "ready") {
    return (
      <Center h="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Center py="xl">
      <Card padding="xl" radius="md" withBorder maw={460} w="100%">
        <Stack align="center" gap="md">
          <Text fw={700} fz="lg" ta="center">
            {target ? t("appQr.redirecting") : android || ios ? t("appQr.chooseStore") : t("appQr.notConfigured")}
          </Text>
          {target && <Loader size="sm" />}
          {/* También con la redirección en curso: si el navegador la bloquea, el visitante toca el botón. */}
          {android && (
            <Button component="a" href={android} size="lg" fullWidth leftSection={<IconBrandGooglePlay size={22} />}>
              {t("appQr.googlePlay")}
            </Button>
          )}
          {ios && (
            <Button
              component="a"
              href={ios}
              size="lg"
              fullWidth
              color="dark"
              leftSection={<IconBrandApple size={22} />}
            >
              {t("appQr.appStore")}
            </Button>
          )}
        </Stack>
      </Card>
    </Center>
  );
}
