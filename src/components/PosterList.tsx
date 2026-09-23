import { useState } from "react";
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
  Badge,
  ActionIcon,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePosters } from "../context/usePosters";
import { Paper } from "../services/firestore/paperService";
import { IconLock, IconLockAccessOff } from "@tabler/icons-react";

export const PosterList = () => {
  const { t } = useTranslation();
  const {
    eventSlug,
    currentPagePosters,
    searchTerm,
    setSearchTerm,
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

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
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

  const renderPoster = (poster: Paper) => (
    <Card
      key={poster.id}
      shadow="sm"
      padding="lg"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
      }}
    >
      <Stack m="xs">
        <Text fw={500}>{poster.title}</Text>
        <Text size="sm" c="dimmed">
          {[poster.theme, getCategoryName(poster.categoryId)].filter(Boolean).join(" / ")}
        </Text>
        <Text size="sm" c="dimmed">
          {t("posterList.authorsLabel")} {poster.authors.join(", ")}
        </Text>
      </Stack>
      <Group justify="flex-end" mt="md">
        <Button
          component={Link}
          to={`/${eventSlug}/paper/${poster.id}`}
          variant="outline"
        >
          {t("posterList.viewPoster")}
        </Button>
      </Group>
    </Card>
  );

  return (
    <Container size="lg">
      <TextInput
        placeholder={t("posterList.searchPlaceholder")}
        size="lg"
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.currentTarget.value)}
        mb="md"
      />

      {categories.length > 0 && (
        <>
          <Text fz="lg" fw={500} mb="xs">
            {t("posterList.categoriesHeading")}
          </Text>
          <SimpleGrid cols={2} spacing="sm" mb="md">
            {categories.map(({ id, name, count, color }) => (
              <Card
                key={id}
                shadow="sm"
                padding="lg"
                style={{
                  cursor: "pointer",
                  border:
                    selectedCategory === id
                      ? `2px solid ${color}`
                      : "1px solid #ddd",
                  backgroundColor: selectedCategory === id ? color : "#fff",
                  color: selectedCategory === id ? "#fff" : "inherit",
                }}
                onClick={() => handleCategorySelect(id)}
              >
                <Group justify="flex-start">
                  <Badge color={color} size="lg" radius="sm">
                    {count}
                  </Badge>
                  <Text fw={500}>
                    {selectedCategory === id
                      ? t("posterList.categoryViewing", { name })
                      : t("posterList.categoryView", { name })}
                  </Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </>
      )}

      <Group justify="center">
        <Select
          placeholder={t("posterList.themeFilterPlaceholder")}
          size="lg"
          data={themes}
          value={selectedTheme}
          onChange={handleThemeChange}
          clearable
          mb="md"
          disabled={isThemeLocked}
          style={{ flexGrow: 1 }}
        />

        <ActionIcon onClick={toggleThemeLock}>
          {isThemeLocked ? <IconLock /> : <IconLockAccessOff />}
        </ActionIcon>
      </Group>

      <Box
        style={{
          height: "70vh",
          overflowY: "auto",
          marginBottom: "1rem",
        }}
      >
        {loading ? (
          <Loader size="lg" />
        ) : currentPagePosters.length === 0 ? (
          <Text>{t("posterList.noResults")}</Text>
        ) : (
          <SimpleGrid cols={{ base: 1, xs: 1, md: 2, lg: 2 }} spacing="lg">
            {currentPagePosters.map((poster) => renderPoster(poster))}
          </SimpleGrid>
        )}
      </Box>

      {currentPagePosters.length > 0 && (
        <Group justify="space-around" my="md">
          <Button
            size="md"
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || loading}
          >
            {t("common.previous")}
          </Button>
          <Text fz="h3">{t("posterList.pageOf", { page, totalPages })}</Text>
          <Button
            size="md"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages || loading}
          >
            {t("common.next")}
          </Button>
        </Group>
      )}
    </Container>
  );
};
