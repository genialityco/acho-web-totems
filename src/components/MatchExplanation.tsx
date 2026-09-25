import { useState } from "react";
import { Button, Group, Loader, Stack, Text } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { explainSearchMatch } from "../services/firestore/searchQueryService";

type ExplanationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error" };

// "¿Por qué este resultado?" de las tarjetas que aparecen solo por significado: pide a Gemini (vía
// la Cloud Function explainSearchMatch) una explicación bajo demanda, no al listar, para pagar
// solo por las que el visitante realmente abre. Quien lo renderiza decide si se muestra (el admin
// puede apagarlo por evento) y lo remonta con `key` al cambiar la búsqueda, lo que la reinicia.
export const MatchExplanation = ({
  eventSlug,
  paperId,
  query,
}: {
  eventSlug: string;
  paperId: string;
  query: string;
}) => {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<ExplanationState>({ status: "idle" });

  const requestExplanation = async () => {
    setState({ status: "loading" });
    try {
      const language = i18n.resolvedLanguage === "en" ? "en" : "es";
      setState({ status: "done", text: await explainSearchMatch(eventSlug, paperId, query, language) });
    } catch (error) {
      console.error("Error al generar la explicación del resultado:", error);
      setState({ status: "error" });
    }
  };

  if (state.status === "done") {
    return (
      <Stack gap={2}>
        <Text size="xs">{state.text}</Text>
        <Text size="xs" c="dimmed" fs="italic">
          {t("posterList.explanation.aiNote")}
        </Text>
      </Stack>
    );
  }

  if (state.status === "loading") {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="xs" c="dimmed">
          {t("posterList.explanation.loading")}
        </Text>
      </Group>
    );
  }

  return (
    <Stack gap={2} align="flex-start">
      <Button
        variant="subtle"
        size="compact-xs"
        leftSection={<IconSparkles size={14} />}
        onClick={() => void requestExplanation()}
      >
        {t("posterList.explanation.button")}
      </Button>
      {state.status === "error" && (
        <Text size="xs" c="red">
          {t("posterList.explanation.error")}
        </Text>
      )}
    </Stack>
  );
};
