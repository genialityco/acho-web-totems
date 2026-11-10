import { Fragment, useMemo, useState } from "react";
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
  ActionIcon,
  Indicator,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { countAdvancedCriteria, EMPTY_ADVANCED_SEARCH, usePosters, SearchMode } from "../context/usePosters";
import { formatAttribute, isListField, selectedOptions, toMantineColor } from "../services/firestore/fieldService";
import { Paper } from "../services/firestore/paperService";
import { RESPONSIVE_BREAKPOINTS_EM } from "../theme";
import { useIsTotem } from "../hooks/useIsTotem";
import { HighlightedText } from "./HighlightedText";
import { MatchExplanation } from "./MatchExplanation";
import { IconAdjustmentsHorizontal, IconEye, IconSearchOff } from "@tabler/icons-react";
import { AdvancedSearchModal } from "./AdvancedSearchModal";
import "./PosterList.css";

// Estilo "glass" (event.publicStyle, ver PublicGlass.css): superficies oscuras traslúcidas y bordes
// luminosos en el color de cada opción. Los colores son nombres de la paleta de Mantine ("green"…).
const colorVar = (color?: string | null) =>
  toMantineColor(color) ? `var(--mantine-color-${toMantineColor(color)}-6)` : "var(--mantine-primary-color-filled)";
const lightColorVar = (color?: string | null) =>
  toMantineColor(color) ? `var(--mantine-color-${toMantineColor(color)}-3)` : "var(--mantine-color-blue-3)";
// El color mezclado con transparencia (pct = opacidad en %), para fondos, bordes y brillos.
const tint = (color: string | null | undefined, pct: number) =>
  `color-mix(in srgb, ${colorVar(color)} ${pct}%, transparent)`;
const GLASS_SURFACE = "rgba(14, 18, 25, 0.62)";
const GLASS_CARD = "rgba(16, 20, 27, 0.84)";
// Botones de filtro sin color propio: uno distinto por opción, para que no se vean todos iguales.
const GLASS_BUTTON_PALETTE = ["red", "violet", "teal", "gray", "orange", "cyan", "pink", "lime"];
const glassBadgeStyles = (color?: string | null) => ({
  root: { backgroundColor: tint(color, 22), color: lightColorVar(color), border: `1px solid ${tint(color, 45)}` },
});

export const PosterList = () => {
  const { t } = useTranslation();
  const {
    eventSlug,
    event,
    posters,
    currentPagePosters,
    searchTerm,
    activeSearchTerm,
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
    selectionRequired,
    getPaperColor,
    advancedSearch,
    setAdvancedSearch,
  } = usePosters();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Estilo del sitio público configurado en el admin; "glass" por defecto.
  const glass = event?.publicStyle !== "classic";
  // Textos sueltos sobre el fondo del evento: en "classic" llevan un recuadro blanco para leerse sobre
  // cualquier imagen; en "glass" el fondo ya está oscurecido y van en texto claro.
  const floatingPill = glass
    ? undefined
    : { backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: "var(--mantine-radius-sm)" };
  const advancedCount = countAdvancedCriteria(advancedSearch);

  // Columnas: solo por ancho (una pantalla angosta necesita cards angostas para que
  // el poster se lea bien, sea o no alta/TV). En 1080px de ancho esto da 2 columnas,
  // aunque sea un panel vertical altísimo.
  const categoryCols = { base: 1, xs: 2, sm: 2, md: 3, lg: 3, xl: 4, tv: 5, giant: 6 };
  const posterCols = { base: 1, xs: 1, sm: 2, md: 2, lg: 3, xl: 4, tv: 5, giant: 6 };
  // Con menos opciones que columnas, cada opción se estira para no dejar un hueco al final de la fila.
  const capColumns = (cols: Record<string, number>, count: number) =>
    Object.fromEntries(Object.entries(cols).map(([size, n]) => [size, Math.max(1, Math.min(n, count))]));

  // Tamaño de letra: por ancho O alto, para que una pantalla vertical altísima (ej.
  // 1080x1920) también reciba texto más grande pensado para verse desde lejos, aunque
  // tenga pocas columnas.
  const isTvUp = useMediaQuery(
    `(min-width: ${RESPONSIVE_BREAKPOINTS_EM.tv}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.tv})`
  );
  const isGiantUp = useMediaQuery(
    `(min-width: ${RESPONSIVE_BREAKPOINTS_EM.giant}), (min-height: ${RESPONSIVE_BREAKPOINTS_EM.giant})`
  );
  // Tótem táctil vertical (ver useIsTotem): etiquetas, contadores y botones más grandes.
  const isTotem = useIsTotem();
  const navigate = useNavigate();

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
    // Las opciones sin color usan el color primario del tema.
    const activeColor = colorVar(color);
    return (
      <Card
        key={key}
        shadow="sm"
        padding={isTotem ? "xl" : "lg"}
        role="button"
        tabIndex={0}
        aria-pressed={active}
        style={
          glass
            ? {
                cursor: "pointer",
                background: `linear-gradient(${tint(color, active ? 34 : 14)}, ${tint(color, active ? 34 : 14)}), ${GLASS_SURFACE}`,
                border: `${active ? 2 : 1}px solid ${tint(color, active ? 100 : 60)}`,
                boxShadow: active
                  ? `0 0 26px ${tint(color, 55)}, inset 0 0 22px ${tint(color, 25)}`
                  : `0 0 14px ${tint(color, 28)}`,
                color: "#f1f3f5",
                backdropFilter: "blur(10px)",
              }
            : {
                cursor: "pointer",
                border: active ? `2px solid ${activeColor}` : "1px solid #ddd",
                backgroundColor: active ? activeColor : "#fff",
                color: active ? "#fff" : "inherit",
              }
        }
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <Group justify="flex-start" wrap="nowrap">
          {/* Seleccionada: contador blanco con el número en el color de la opción (antes era del mismo
              color que el fondo de la tarjeta y casi no se veía). */}
          <Badge
            color={toMantineColor(color) ?? undefined}
            size={isTotem ? "xl" : "lg"}
            radius="sm"
            variant={glass ? "light" : active ? "white" : "filled"}
            styles={glass ? glassBadgeStyles(color) : undefined}
          >
            {count}
          </Badge>
          <Text fw={600} fz={isTotem ? "1.375rem" : undefined}>
            {label}
          </Text>
        </Group>
      </Card>
    );
  };

  const renderFilterButton = (
    key: string,
    label: string,
    count: number,
    active: boolean,
    onSelect: () => void,
    glassColor: string
  ) => (
    <Button
      key={key}
      size={isTotem ? "xl" : isTvUp ? "lg" : "md"}
      radius="xl"
      variant={glass ? "default" : active ? "filled" : "default"}
      aria-pressed={active}
      onClick={onSelect}
      styles={
        glass
          ? {
              root: {
                background: `linear-gradient(${tint(glassColor, active ? 38 : 14)}, ${tint(glassColor, active ? 38 : 14)}), ${GLASS_SURFACE}`,
                border: `${active ? 2 : 1}px solid ${tint(glassColor, active ? 100 : 55)}`,
                color: "#f1f3f5",
                boxShadow: active ? `0 0 20px ${tint(glassColor, 50)}` : `0 0 10px ${tint(glassColor, 22)}`,
                backdropFilter: "blur(10px)",
              },
            }
          : undefined
      }
      rightSection={
        <Badge
          size={isTotem ? "xl" : "sm"}
          variant={glass ? "light" : active ? "white" : "light"}
          radius="sm"
          styles={glass ? glassBadgeStyles(glassColor) : undefined}
        >
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

    const posterUrl = `/${eventSlug}/paper/${poster.id}`;

    return (
      <Card
        key={poster.id}
        shadow="sm"
        padding={isTotem ? "xl" : "lg"}
        radius="md"
        withBorder
        className="posterCard"
        // Toda la tarjeta abre el póster (en una pantalla táctil se toca donde sea, no solo el botón).
        // Los elementos interactivos de adentro (el botón, la explicación) conservan su propio clic. El
        // botón sigue siendo el acceso por teclado, así que la tarjeta no agrega otra parada de tabulación.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button, [role='button']")) return;
          navigate(posterUrl);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          cursor: "pointer",
          ...(glass
            ? {
                backgroundColor: GLASS_CARD,
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.09)",
                borderLeft: `4px solid ${colorVar(color)}`,
                boxShadow: `-8px 0 22px -10px ${tint(color, 95)}, 0 10px 28px rgba(0, 0, 0, 0.35)`,
                color: "#f1f3f5",
              }
            : { borderLeft: color ? `6px solid ${colorVar(color)}` : undefined }),
        }}
      >
        <Stack gap={isTotem ? "sm" : "xs"}>
          {listBadges.length > 0 && (
            <Group gap={6} wrap="wrap">
              {listBadges.map((badge) => (
                <Badge
                  key={badge.key}
                  color={toMantineColor(badge.color) ?? "gray"}
                  variant={badge.color ? "light" : "outline"}
                  size={isTotem ? "lg" : "sm"}
                  styles={glass ? glassBadgeStyles(badge.color ?? "gray") : undefined}
                >
                  {badge.name}
                </Badge>
              ))}
            </Group>
          )}
          <Text
            fw={glass ? 700 : 600}
            fz={isTotem ? "1.5rem" : isGiantUp ? "xl" : isTvUp ? "lg" : "md"}
            lh={1.3}
            lineClamp={isTotem ? 5 : 4}
            c={glass ? "white" : undefined}
          >
            <HighlightedText text={poster.title} term={highlightTerm} />
          </Text>
          {valueBadges.length > 0 && (
            <Group gap={6} wrap="wrap">
              {valueBadges.map(({ field, text }) => (
                <Tooltip key={field.id} label={field.label}>
                  <Badge
                    variant="light"
                    color="gray"
                    size={isTotem ? "lg" : "sm"}
                    styles={
                      glass
                        ? { root: { backgroundColor: "rgba(255, 255, 255, 0.08)", color: "var(--mantine-color-gray-3)" } }
                        : undefined
                    }
                  >
                    {text}
                  </Badge>
                </Tooltip>
              ))}
            </Group>
          )}
          {/* gray.7 y no "dimmed": el gris claro casi no se lee en pantalla grande. En tótem se acortan
              las listas largas de autores para que no empujen el botón. */}
          <Text fz={isTotem ? "1.0625rem" : "sm"} c={glass ? "gray.4" : "gray.7"} lineClamp={isTotem ? 3 : undefined}>
            {t("posterList.authorsLabel")}{" "}
            {poster.authors.map((author, i) => (
              <Fragment key={i}>
                {i > 0 && ", "}
                <HighlightedText text={author} term={highlightTerm} />
              </Fragment>
            ))}
          </Text>
          {snippet && (
            <Text fz={isTotem ? "md" : "xs"} c={glass ? "gray.5" : "gray.7"}>
              {t("posterList.matchInDocument")} “{snippet.before}
              <Mark>{snippet.match}</Mark>
              {snippet.after}”
            </Text>
          )}
          {canExplainMatch(poster.id) && (
            <MatchExplanation key={activeSearchTerm} eventSlug={eventSlug} paperId={poster.id} query={activeSearchTerm} />
          )}
        </Stack>
        {glass ? (
          // Botón de borde luminoso en el color de la especialidad (el de la tarjeta).
          <Button
            component={Link}
            to={posterUrl}
            size={isTotem ? "lg" : "md"}
            fullWidth
            mt={isTotem ? "lg" : "md"}
            variant="default"
            leftSection={<IconEye size={isTotem ? 22 : 18} />}
            styles={{
              root: {
                backgroundColor: tint(color, 10),
                border: `2px solid ${colorVar(color)}`,
                color: "#f1f3f5",
                boxShadow: `0 0 16px ${tint(color, 55)}, inset 0 0 12px ${tint(color, 25)}`,
              },
            }}
          >
            {t("posterList.viewPoster")}
          </Button>
        ) : isTotem ? (
          // Botón ancho y relleno, en el color de la tarjeta: el llamado a la acción se ve desde lejos.
          <Button
            component={Link}
            to={posterUrl}
            size="lg"
            fullWidth
            mt="lg"
            color={toMantineColor(color) ?? undefined}
          >
            {t("posterList.viewPoster")}
          </Button>
        ) : (
          <Group justify="flex-end" mt="md">
            <Button component={Link} to={posterUrl} variant="outline">
              {t("posterList.viewPoster")}
            </Button>
          </Group>
        )}
      </Card>
    );
  };

  // "Resultados: x de y": solo con una búsqueda activa y ya calculada (en modo conceptual
  // el resultado no es válido hasta que llega el embedding de la consulta). Va sobre el fondo del
  // evento, que puede ser oscuro: lleva el mismo recuadro blanco translúcido que los otros textos sueltos.
  const resultsCountLabel =
    activeSearchTerm && !semanticSearchLoading ? (
      <Text
        fz={isTotem || isGiantUp ? "xl" : isTvUp ? "lg" : "sm"}
        fw={600}
        c={glass ? "gray.2" : "dark.6"}
        mb="sm"
        px={glass ? 0 : "sm"}
        py={4}
        w="fit-content"
        style={floatingPill}
      >
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
            size={isTotem ? "xl" : "lg"}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            rightSectionWidth={(semanticSearchLoading ? 76 : 48) + (isTotem ? 16 : 0)}
            rightSection={
              <Group gap={6} wrap="nowrap">
                {semanticSearchLoading && <Loader size="xs" />}
                <Tooltip label={t("posterList.advancedSearch.open")}>
                  <Indicator label={advancedCount} size={16} disabled={advancedCount === 0}>
                    <ActionIcon
                      variant={advancedCount ? "filled" : "subtle"}
                      size={isTotem ? "xl" : "lg"}
                      aria-label={t("posterList.advancedSearch.open")}
                      onClick={() => setAdvancedOpen(true)}
                    >
                      <IconAdjustmentsHorizontal size={isTotem ? 28 : 20} />
                    </ActionIcon>
                  </Indicator>
                </Tooltip>
              </Group>
            }
          />
          <Group justify="space-between" wrap="wrap" gap="xs">
            <SegmentedControl
              size={isTotem ? "lg" : "sm"}
              value={searchMode}
              onChange={handleSearchModeChange}
              data={[
                { value: "exact", label: t("posterList.searchModeExact") },
                { value: "semantic", label: t("posterList.searchModeSemantic") },
                { value: "both", label: t("posterList.searchModeBoth") },
              ]}
            />
            {/* Va sobre el fondo del evento: recuadro claro, como los demás textos sueltos. */}
            <Text
              fz={isTotem ? "md" : "xs"}
              c={glass ? "gray.3" : "dark.6"}
              px="sm"
              py={4}
              style={
                glass
                  ? {
                      backgroundColor: GLASS_SURFACE,
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "var(--mantine-radius-sm)",
                    }
                  : floatingPill
              }
            >
              {t(`posterList.searchModeCaption.${searchMode}`)}
            </Text>
          </Group>
          {advancedCount > 0 && (
            <Group gap="xs">
              <Badge size="lg" variant="filled" style={{ cursor: "pointer" }} onClick={() => setAdvancedOpen(true)}>
                {t("posterList.advancedSearch.active", { count: advancedCount })}
              </Badge>
              <Button size="compact-sm" variant="white" onClick={() => setAdvancedSearch(EMPTY_ADVANCED_SEARCH)}>
                {t("posterList.advancedSearch.remove")}
              </Button>
            </Group>
          )}
          <AdvancedSearchModal opened={advancedOpen} onClose={() => setAdvancedOpen(false)} />
        </Stack>

        {filters.map(({ field, options, selected }) => {
          return (
            <Stack key={field.id} gap="xs">
              {/* Fondo claro propio: el título va directo sobre la imagen de fondo del evento. */}
              <Text
                fz={isTotem ? "1.625rem" : isTvUp ? "xl" : "lg"}
                fw={700}
                px={glass ? 0 : isTotem ? "md" : "sm"}
                py={isTotem ? 4 : 2}
                w="fit-content"
                c={glass ? "white" : undefined}
                style={glass ? undefined : { ...floatingPill, backgroundColor: "rgba(255, 255, 255, 0.92)" }}
              >
                {field.label}
              </Text>
              {field.filter === "cards" ? (
                <SimpleGrid cols={capColumns(categoryCols, options.length)} spacing={isTotem ? "md" : "sm"}>
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
                  {options.map(({ id, name, count, color }, index) =>
                    renderFilterButton(
                      id,
                      name,
                      count,
                      selected.includes(id),
                      () => toggleFilterOption(field.id, id),
                      color ?? GLASS_BUTTON_PALETTE[index % GLASS_BUTTON_PALETTE.length]
                    )
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
        ) : selectionRequired ? (
          <Center py="xl">
            <Text
              fz={isGiantUp ? "xl" : "lg"}
              fw={600}
              ta="center"
              px="lg"
              py="md"
              c={glass ? "gray.1" : undefined}
              style={
                glass
                  ? {
                      backgroundColor: GLASS_SURFACE,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "var(--mantine-radius-md)",
                      backdropFilter: "blur(10px)",
                    }
                  : { backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: "var(--mantine-radius-md)" }
              }
            >
              {t("posterList.selectFiltersPrompt", {
                filters: filters.map((f) => f.field.label.toLowerCase()).join(t("posterList.andOr")),
              })}
            </Text>
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
            <SimpleGrid cols={posterCols} spacing={isTotem ? "xl" : { base: "md", lg: "lg" }}>
              {currentPagePosters.map((poster) => renderPoster(poster))}
            </SimpleGrid>

            {totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination total={totalPages} value={page} onChange={setPage} withEdges size={isTotem ? "xl" : "md"} />
              </Group>
            )}
          </Box>
        )}
      </Stack>
    </Container>
  );
};
