import { useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useIdleTimer } from "../hooks/useIdleTimer";
import { ScreensaverItem } from "../services/firestore/screensaverService";

export default function ScreensaverOverlay({
  items,
  idleSeconds,
  photoDurationSeconds,
}: {
  items: ScreensaverItem[];
  idleSeconds: number;
  photoDurationSeconds: number;
}) {
  const { t } = useTranslation();
  const isIdle = useIdleTimer(idleSeconds, true);
  const [index, setIndex] = useState(0);
  const wasIdle = useRef(false);

  // Siempre arranca desde el primer elemento cada vez que se activa.
  useEffect(() => {
    if (isIdle && !wasIdle.current) setIndex(0);
    wasIdle.current = isIdle;
  }, [isIdle]);

  const current = items[index % items.length];

  // Las fotos avanzan solas tras photoDurationSeconds; los videos avanzan con onEnded.
  useEffect(() => {
    if (!isIdle || current?.type !== "image") return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
    }, photoDurationSeconds * 1000);
    return () => clearTimeout(timer);
  }, [isIdle, index, current?.type, photoDurationSeconds, items.length]);

  if (!isIdle || !current) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {current.type === "video" ? (
        <video
          key={current.id}
          src={current.url}
          autoPlay
          muted
          playsInline
          // Con un solo video, onEnded no cambiaría de índice (mismo valor), así que no
          // volvería a renderizar y el video quedaría congelado en el último cuadro.
          loop={items.length === 1}
          onEnded={() => setIndex((i) => (i + 1) % items.length)}
          style={{ width: "100%", height: "100%", objectFit: current.fit }}
        />
      ) : (
        <img
          key={current.id}
          src={current.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: current.fit }}
        />
      )}
      <Text
        style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center" }}
        c="white"
        opacity={0.6}
        size="sm"
      >
        {t("screensaver.tapToContinue")}
      </Text>
    </div>
  );
}
