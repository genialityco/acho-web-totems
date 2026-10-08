import { Fragment, useMemo } from "react";
import {
  TextInput,
  Card,
  Text,
  Mark,
  Loader,
  Button,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Box,
  SegmentedControl,
  Badge,
  Center,
  Pagination,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePosters, SearchMode } from "../context/usePosters";
import { formatAttribute, isListField, selectedOptions } from "../services/firestore/fieldService";
import { Paper } from "../services/firestore/paperService";
import { RESPONSIVE_BREAKPOINTS_EM } from "../theme";
import { HighlightedText } from "./HighlightedText";
import { MatchExplanation } from "./MatchExplanation";
import { IconSearchOff } from "@tabler/icons-react";
import "./PosterList.css";

export const PosterList = () => {
  const { t } = useTranslation();
  const {
    eventSlug,
    posters,
    currentPagePosters,
    searchTerm,
    setSearchTerm,
    searchMode,
    setSearchMode,
    semanticSearchLoading,
    totalResults,
    highlightTerm,
    getBodySnippet,
    canExplainMatch,
    loading,
    page,
    setPage,
    totalPages,
    fields,
    filters,
    toggleFilterOption,
    getPaperColor,
  } = usePosters();

  // Columnas: solo por ancho (una pantalla angosta necesita cards angostas para que
  // el poster se lea bien, sea o no alta/TV). En 1080px de ancho esto da 2 columnas,
  // aunque sea un panel vertical altísimo.
  const categoryCols = { base: 1, xs: 2, sm: 2, md: 3, lg: 3, xl: 4, tv: 5, giant: 6 };
  const posterCols = { base: 1, xs: 1, sm: 2, md: 2, lg: 3, xl: 4, tv: 5, giant: 6 };

  // Tamaño de letra: por ancho O alto, para que una pantalla vertical altísima (ej.
  // 1080x1920) también reciba texto más grande pensado para verse desde lejos, aunque
  // tenga pocas columnas.
  const isTvUp = useMediaQuery(
    `(min-width: ${RESPONSIVE_BREAKPOINTS_EM.tv}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.tv})`
  );
  const isGiantUp = useMediaQuery(
    `(min-width: ${RESPONSIVE_BREAKPOINTS_EM.giant}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.giant})`
  );

  // Campos que se muestran en la tarjeta: los de lista como etiquetas arriba del título, los de
  // texto/número como etiquetas grises (con el nombre del campo en el tooltip) debajo.
  const cardListFields = useMemo(() => fields.filter((f) => f.showOnCard && isListField(f)), [fields]);
  const cardValueFields = useMemo(() => fields.filter((f) => f.showOnCard && !isListField(f)), [fields]);

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    setPage(1);
  };

  const handleSearchModeChange = (mode: string) => {
    setSearchMode(mode as SearchMode);
    setPage(1);
  };

  const renderFilterCard = (
    key: string,
    label: string,
    count: number,
    color: string | undefined,
    active: boolean,
    onSelect: () => void
  ) => {
    // "Ver todos" (y las opciones sin color) usan el color primario del tema.
    const activeColor = color ? `var(--mantine-color-${color}-6)` : "var(--mantine-primary-color-filled)";
    return (
      <Card
        key={key}
        shadow="sm"
        padding="lg"
        role="button"
        tabIndex={0}
        aria-pressed={active}
        style={{
          cursor: "pointer",
          border: active ? `2px solid ${activeColor}` : "1px solid #ddd",
          backgroundColor: active ? activeColor : "#fff",
          color: active ? "#fff" : "inherit",
        }}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <Group justify="flex-start" wrap="nowrap">
          <Badge color={color} size="lg" radius="sm" variant={active && !color ? "white" : "filled"}>
            {count}
          </Badge>
          <Text fw={500}>{label}</Text>
        </Group>
      </Card>
    );
  };

  const renderFilterButton = (key: string, label: string, count: number, active: boolean, onSelect: () => void) => (
    <Button
      key={key}
      size={isTvUp ? "lg" : "md"}
      radius="xl"
      variant={active ? "filled" : "default"}
      aria-pressed={active}
      onClick={onSelect}
      rightSection={
        <Badge size="sm" variant={active ? "white" : "light"} radius="sm">
          {count}
        </Badge>
      }
    >
      {label}
    </Button>
  );

  const renderPoster = (poster: Paper) => {
    const color = getPaperColor(poster);
    const snippet = getBodySnippet(poster.id);
    const listBadges = cardListFields.flatMap((field) =>
      selectedOptions(field, poster.attributes[field.id]).map((option) => ({
        key: `${field.id}:${option.id}`,
        name: option.name,
        // Solo los filtros de tarjetas de colores pintan sus etiquetas.
        color: field.filter === "cards" && option.color ? option.color : null,
      }))
    );
    const valueBadges = cardValueFields
      .map((field) => ({ field, text: formatAttribute(field, poster.attributes[field.id]) }))
      .filter(({ text }) => text);

    return (
      <Card
        key={poster.id}
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        className="posterCard"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          borderLeft: color ? `6px solid var(--mantine-color-${color}-6)` : undefined,
        }}
      >
        <Stack gap="xs">
          {listBadges.length > 0 && (
            <Group gap={6} wrap="wrap">
              {listBadges.map((badge) => (
                <Badge
                  key={badge.key}
                  color={badge.color ?? "gray"}
                  variant={badge.color ? "light" : "outline"}
                  size="sm"
                >
                  {badge.name}
                </Badge>
              ))}
            </Group>
          )}
          <Text fw={600} fz={isGiantUp ? "xl" : isTvUp ? "lg" : "md"} lineClamp={4}>
            <HighlightedText text={poster.title} term={highlightTerm} />
          </Text>
          {valueBadges.length > 0 && (
            <Group gap={6} wrap="wrap">
              {valueBadges.map(({ field, text }) => (
                <Tooltip key={field.id} label={field.label}>
                  <Badge variant="light" color="gray" size="sm">
                    {text}
                  </Badge>
                </Tooltip>
              ))}
            </Group>
          )}
          <Text size="sm" c="dimmed">
            {t("posterList.authorsLabel")}{" "}
            {poster.authors.map((author, i) => (
              <Fragment key={i}>
                {i > 0 && ", "}
                <HighlightedText text={author} term={highlightTerm} />
              </Fragment>
            ))}
          </Text>
          {snippet && (
            <Text size="xs" c="dimmed">
              {t("posterList.matchInDocument")} “{snippet.before}
              <Mark>{snippet.match}</Mark>
              {snippet.after}”
            </Text>
          )}
          {canExplainMatch(poster.id) && (
            <MatchExplanation key={searchTerm} eventSlug={eventSlug} paperId={poster.id} query={searchTerm} />
          )}
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button component={Link} to={`/${eventSlug}/paper/${poster.id}`} variant="outline">
            {t("posterList.viewPoster")}
          </Button>
        </Group>
      </Card>
    );
  };

  // "Resultados: x de y": solo con una búsqueda activa y ya calculada (en modo conceptual
  // el resultado no es válido hasta que llega el embedding de la consulta).
  const resultsCountLabel =
    searchTerm.trim() && !semanticSearchLoading ? (
      <Text fz={isGiantUp ? "xl" : isTvUp ? "lg" : "sm"} fw={600} c="dark.6" mb="sm">
        {t("posterList.resultsCount", { shown: totalResults, total: posters.length })}
      </Text>
    ) : null;

  return (
    <Container
      fluid
      mx="auto"
      maw={{ base: "100%", lg: 1200, xl: 1500, tv: 1900, giant: 2300 }}
      px={{ base: "sm", sm: "md", tv: "xl" }}
      py="md"
    >
      <Stack gap="xl">
        <Stack gap="xs">
          <TextInput
            placeholder={t("posterList.searchPlaceholder")}
            size="lg"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            rightSection={semanticSearchLoading ? <Loader size="xs" /> : null}
          />
          <Group justify="space-between" wrap="wrap" gap="xs">
            <SegmentedControl
              value={searchMode}
              onChange={handleSearchModeChange}
              data={[
                { value: "exact", label: t("posterList.searchModeExact") },
                { value: "semantic", label: t("posterList.searchModeSemantic") },
                { value: "both", label: t("posterList.searchModeBoth") },
              ]}
            />
            <Text size="xs" c="dimmed">
              {t(`posterList.searchModeCaption.${searchMode}`)}
            </Text>
          </Group>
        </Stack>

        {filters.map(({ field, options, allCount, selected }) => {
          const allActive = selected.length === 0;
          return (
            <Stack key={field.id} gap="xs">
              {/* Fondo claro propio: el título va directo sobre la imagen de fondo del evento. */}
              <Text
                fz={isTvUp ? "xl" : "lg"}
                fw={600}
                px="sm"
                py={2}
                w="fit-content"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.85)", borderRadius: "var(--mantine-radius-sm)" }}
              >
                {field.label}
              </Text>
              {field.filter === "cards" ? (
                <SimpleGrid cols={categoryCols} spacing="sm">
                  {renderFilterCard(
                    "__all__",
                    allActive ? t("posterList.viewingAll") : t("posterList.viewAll"),
                    allCount,
                    undefined,
                    allActive,
                    () => toggleFilterOption(field.id, null)
                  )}
                  {options.map(({ id, name, count, color }) => {
                    const active = selected.includes(id);
                    return renderFilterCard(
                      id,
                      active ? t("posterList.categoryViewing", { name }) : t("posterList.categoryView", { name }),
                      count,
                      color ?? undefined,
                      active,
                      () => toggleFilterOption(field.id, id)
                    );
                  })}
                </SimpleGrid>
              ) : (
                <Group gap="sm">
                  {renderFilterButton("__all__", t("posterList.viewAll"), allCount, allActive, () =>
                    toggleFilterOption(field.id, null)
                  )}
                  {options.map(({ id, name, count }) =>
                    renderFilterButton(id, name, count, selected.includes(id), () => toggleFilterOption(field.id, id))
                  )}
                </Group>
              )}
            </Stack>
          );
        })}

        {loading ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : currentPagePosters.length === 0 ? (
          <Box>
            {resultsCountLabel}
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconSearchOff size={32} opacity={0.5} />
                <Text c="dimmed">{t("posterList.noResults")}</Text>
              </Stack>
            </Center>
          </Box>
        ) : (
          <Box>
            {resultsCountLabel}
            <SimpleGrid cols={posterCols} spacing={{ base: "md", lg: "lg" }}>
              {currentPagePosters.map((poster) => renderPoster(poster))}
            </SimpleGrid>

            {totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination total={totalPages} value={page} onChange={setPage} withEdges />
              </Group>
            )}
          </Box>
        )}
      </Stack>
    </Container>
  );
};
