import { Box, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { usePosters } from "../context/usePosters";
import { useIsTotem } from "../hooks/useIsTotem";
import { useVotingPhase } from "../hooks/useVotingPhase";

const pad = (n: number) => String(n).padStart(2, "0");

// Cuenta regresiva de la landing: hasta la apertura de la votación mientras está programada, y
// hasta el cierre mientras está abierta (si tiene fecha de cierre). Sin fecha por delante no se muestra.
export default function VotingCountdown() {
  const { t, i18n } = useTranslation();
  const { event } = usePosters();
  const { phase, now, nextChange } = useVotingPhase(event);
  const isTotem = useIsTotem();

  if (!event || !nextChange || (phase !== "scheduled" && phase !== "open")) return null;

  const glass = event.publicStyle !== "classic";
  const opening = phase === "scheduled";
  const totalSeconds = Math.max(0, Math.floor((nextChange.getTime() - now) / 1000));
  const units = [
    { value: Math.floor(totalSeconds / 86400), label: t("votingCountdown.days") },
    { value: Math.floor((totalSeconds % 86400) / 3600), label: t("votingCountdown.hours") },
    { value: Math.floor((totalSeconds % 3600) / 60), label: t("votingCountdown.minutes") },
    { value: totalSeconds % 60, label: t("votingCountdown.seconds") },
  ];
  const accent = opening ? "#4dabf7" : "#ff922b";
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" }).format(nextChange);

  return (
    <Box
      role="timer"
      aria-live="off"
      mb="md"
      p={isTotem ? "lg" : "md"}
      style={{
        borderRadius: 12,
        textAlign: "center",
        ...(glass
          ? {
              background: "rgba(16, 20, 28, 0.6)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${accent}99`,
              boxShadow: `0 0 22px ${accent}40`,
              color: "#f1f3f5",
            }
          : { background: "#fff", border: `2px solid ${accent}`, color: "#212529" }),
      }}
    >
      <Stack gap={isTotem ? "sm" : 6} align="center">
        <Text fw={700} size={isTotem ? "xl" : "lg"} tt="uppercase" style={{ letterSpacing: 1 }}>
          {opening ? t("votingCountdown.opensIn") : t("votingCountdown.closesIn")}
        </Text>
        <Group gap={isTotem ? "lg" : "sm"} justify="center" wrap="nowrap">
          {units.map((u, i) => (
            <Stack key={u.label} gap={0} align="center" miw={isTotem ? 96 : 56}>
              <Text
                fw={800}
                fz={isTotem ? 56 : "clamp(28px, 6vw, 42px)"}
                lh={1.1}
                c={accent}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {i === 0 ? u.value : pad(u.value)}
              </Text>
              <Text size={isTotem ? "md" : "xs"} c="dimmed" tt="uppercase">
                {u.label}
              </Text>
            </Stack>
          ))}
        </Group>
        <Text size={isTotem ? "md" : "sm"} c="dimmed">
          {opening ? t("votingCountdown.opensOn", { date }) : t("votingCountdown.closesOn", { date })}
        </Text>
      </Stack>
    </Box>
  );
}
