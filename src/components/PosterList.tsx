import { useMemo, useState } from "react";
import {
  TextInput,
  Card,
  Text,
  Loader,
  Button,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Box,
  Select,
  SegmentedControl,
  Badge,
  ActionIcon,
  Center,
  Pagination,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePosters, SearchMode } from "../context/usePosters";
import { Paper } from "../services/firestore/paperService";
import { RESPONSIVE_BREAKPOINTS_EM } from "../theme";
import { IconLock, IconLockAccessOff, IconSearchOff } from "@tabler/icons-react";
import "./PosterList.css";

export const PosterList = () => {
  const { t } = useTranslation();
  const {
    eventSlug,
    currentPagePosters,
    searchTerm,
    setSearchTerm,
    searchMode,
    setSearchMode,
    semanticSearchLoading,
    loading,
    page,
    setPage,
    totalPages,
    selectedCategory,
    setSelectedCategory,
    selectedTheme,
    setSelectedTheme,
    categories,
    themes,
    getCategoryName,
  } = usePosters();

  const [isThemeLocked, setIsThemeLocked] = useState(false);

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

  const categoryColorById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.color])),
    [categories]
  );

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    setPage(1);
  };

  const handleSearchModeChange = (mode: string) => {
    setSearchMode(mode as SearchMode);
    setPage(1);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    setPage(1);
  };

  const handleThemeChange = (value: string | null) => {
    if (!isThemeLocked) {
      setSelectedTheme(value);
      setPage(1);
    }
  };

  const toggleThemeLock = () => {
    setIsThemeLocked((prev) => !prev);
  };

  const renderPoster = (poster: Paper) => {
    const color = poster.categoryId ? categoryColorById.get(poster.categoryId) : undefined;

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
          {color && (
            <Badge color={color} variant="light" size="sm" w="fit-content">
              {getCategoryName(poster.categoryId)}
            </Badge>
          )}
          <Text fw={600} fz={isGiantUp ? "xl" : isTvUp ? "lg" : "md"} lineClamp={2}>
            {poster.title}
          </Text>
          {poster.theme && (
            <Text size="sm" c="dimmed">
              {poster.theme}
            </Text>
          )}
          <Text size="sm" c="dimmed">
            {t("posterList.authorsLabel")} {poster.authors.join(", ")}
          </Text>
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button component={Link} to={`/${eventSlug}/paper/${poster.id}`} variant="outline">
            {t("posterList.viewPoster")}
          </Button>
        </Group>
      </Card>
    );
  };

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

        {categories.length > 0 && (
          <Stack gap="xs">
            <Text fz={isTvUp ? "xl" : "lg"} fw={500}>
              {t("posterList.categoriesHeading")}
            </Text>
            <SimpleGrid cols={categoryCols} spacing="sm">
              {categories.map(({ id, name, count, color }) => {
                const active = selectedCategory === id;
                return (
                  <Card
                    key={id}
                    shadow="sm"
                    padding="lg"
                    role="button"
                    tabIndex={0}
                    style={{
                      cursor: "pointer",
                      border: active ? `2px solid var(--mantine-color-${color}-6)` : "1px solid #ddd",
                      backgroundColor: active ? `var(--mantine-color-${color}-6)` : "#fff",
                      color: active ? "#fff" : "inherit",
                    }}
                    onClick={() => handleCategorySelect(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCategorySelect(id);
                      }
                    }}
                  >
                    <Group justify="flex-start" wrap="nowrap">
                      <Badge color={color} size="lg" radius="sm">
                        {count}
                      </Badge>
                      <Text fw={500}>
                        {active ? t("posterList.categoryViewing", { name }) : t("posterList.categoryView", { name })}
                      </Text>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        )}

        <Group justify="center">
          <Select
            placeholder={t("posterList.themeFilterPlaceholder")}
            size="lg"
            data={themes}
            value={selectedTheme}
            onChange={handleThemeChange}
            clearable
            disabled={isThemeLocked}
            style={{ flexGrow: 1 }}
          />

          <ActionIcon onClick={toggleThemeLock} size="lg" variant="default">
            {isThemeLocked ? <IconLock /> : <IconLockAccessOff />}
          </ActionIcon>
        </Group>

        {loading ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : currentPagePosters.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconSearchOff size={32} opacity={0.5} />
              <Text c="dimmed">{t("posterList.noResults")}</Text>
            </Stack>
          </Center>
        ) : (
          <Box>
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
