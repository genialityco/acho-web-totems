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
import { usePosters } from "../context/PostersContext";
import { Poster } from "../services/api/posterService";
import { IconLock, IconLockAccessOff } from "@tabler/icons-react";

export const PosterList = () => {
  const {
    currentPagePosters,
    searchTerm,
    setSearchTerm,
    loading,
    page,
    setPage,
    totalPages,
    selectedTopic,
    setSelectedTopic,
    selectedCategory,
    setSelectedCategory,
    topics,
    categories,
  } = usePosters();

  const [isCategoryLocked, setIsCategoryLocked] = useState(false);

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    setPage(1);
  };

  const handleTopicSelect = (topic: string | null) => {
    setSelectedTopic(topic === selectedTopic ? null : topic);
    setPage(1);
  };

  const handleCategoryChange = (value: string | null) => {
    if (!isCategoryLocked) {
      setSelectedCategory(value);
      setPage(1);
    }
  };

  const toggleCategoryLock = () => {
    setIsCategoryLocked((prev) => !prev);
  };

  const renderPoster = (poster: Poster) => (
    <Card
      key={poster._id}
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
          {poster.category} {poster.topic ? `/ ${poster.topic}` : ""}
        </Text>
        <Text size="sm" c="dimmed">
          Autor(es): {poster.authors.join(", ")}
        </Text>
      </Stack>
      <Group justify="flex-end" mt="md">
        <Button component={Link} to={`/poster/${poster._id}`} variant="outline">
          Ver póster
        </Button>
      </Group>
    </Card>
  );

  return (
    <Container size="lg">
      <TextInput
        placeholder="Buscar un póster..."
        size="lg"
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.currentTarget.value)}
        mb="md"
      />

      <Text fz="lg" fw={500} mb="xs">
        Categorías
      </Text>
      <SimpleGrid cols={2} spacing="sm" mb="md">
        {topics.map(({ topic, count, color }) => (
          <Card
            key={topic}
            shadow="sm"
            padding="lg"
            style={{
              cursor: "pointer",
              border:
                selectedTopic === topic
                  ? `2px solid ${color}`
                  : "1px solid #ddd",
              backgroundColor: selectedTopic === topic ? `${color}20` : "#fff",
            }}
            onClick={() => handleTopicSelect(topic)}
          >
            <Group justify="flex-start">
              <Badge color={color} size="lg" radius="sm">
                {count}
              </Badge>
              <Text fw={500}>{topic}</Text>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Group justify="center">
        <Select
          placeholder="Filtrar por tema"
          size="lg"
          data={categories}
          value={selectedCategory}
          onChange={handleCategoryChange}
          clearable
          mb="md"
          disabled={isCategoryLocked}
          style={{ flexGrow: 1 }}
        />

        <ActionIcon onClick={toggleCategoryLock}>
          {isCategoryLocked ? <IconLock /> : <IconLockAccessOff />}
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
          <Text>No se encontraron pósters.</Text>
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
            Anterior
          </Button>
          <Text fz="h3">
            Página {page} de {totalPages}
          </Text>
          <Button
            size="md"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages || loading}
          >
            Siguiente
          </Button>
        </Group>
      )}
    </Container>
  );
};
