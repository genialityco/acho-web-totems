import { useEffect, useState } from "react";
import { ActionIcon, Modal, Stack, Text, Tooltip } from "@mantine/core";
import { IconQrcode } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { useIdleTimer } from "../hooks/useIdleTimer";
import { useIsTotem } from "../hooks/useIsTotem";
import { appLinkUrl } from "../utils/appPlatform";
import { trackEvent } from "../services/analytics";

// Botón casi imperceptible (arriba a la izquierda del encabezado) que muestra el QR de la app del evento.
// El QR lleva a /<evento>/app, que redirige a Google Play o a la App Store según el celular que lo lea
// (ver AppRedirectPage). Solo se monta si el admin configuró al menos un enlace de tienda.
export default function AppQrButton({ eventSlug, idleSeconds }: { eventSlug: string; idleSeconds: number }) {
  const { t } = useTranslation();
  const isTotem = useIsTotem();
  const [opened, setOpened] = useState(false);
  // En el tótem, si nadie lo cierra, se cierra solo con la inactividad (no lo encuentra abierto el siguiente).
  const idle = useIdleTimer(idleSeconds, opened);
  useEffect(() => {
    if (idle) setOpened(false);
  }, [idle]);

  const open = () => {
    setOpened(true);
    trackEvent("app_qr_opened", { event_slug: eventSlug });
  };

  return (
    <>
      <Tooltip label={t("appQr.buttonLabel")}>
        <ActionIcon
          variant="transparent"
          color="gray"
          size={isTotem ? "xl" : "lg"}
          aria-label={t("appQr.buttonLabel")}
          onClick={open}
          className="appQrButton"
        >
          <IconQrcode size={isTotem ? 30 : 22} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("appQr.title")} centered size={isTotem ? "lg" : "md"}>
        <Stack align="center" gap="md" pb="sm">
          {/* Fondo blanco con margen: los lectores de QR necesitan contraste y "zona silenciosa". */}
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, lineHeight: 0 }}>
            <QRCodeSVG value={appLinkUrl(eventSlug)} size={isTotem ? 420 : 280} level="M" />
          </div>
          <Text ta="center" fz={isTotem ? "lg" : "sm"} c="dimmed" maw={420}>
            {t("appQr.hint")}
          </Text>
        </Stack>
      </Modal>
    </>
  );
}
