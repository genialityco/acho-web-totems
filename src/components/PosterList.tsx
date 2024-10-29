import React, { useState, useEffect } from "react";
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
} from "@mantine/core";
import { Link } from "react-router-dom";
import { searchPosters, Poster } from "../services/api/posterService";
import debounce from "lodash.debounce";

export const PosterList = () => {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");

  useEffect(() => {
    const handler = debounce(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    handler();
    return () => handler.cancel();
  }, [searchTerm]);

  const fetchFilteredPosters = async () => {
    setLoading(true);
    try {
      const filters = {
        search: debouncedSearchTerm,
        page,
        limit,
      };
      const response = (await searchPosters(filters)) as {
        status: string;
        data: { items: Poster[]; totalPages: number };
      };

      if (response.status === "success") {
        setPosters(response.data.items);
        setTotalPages(response.data.totalPages);
      } else {
        setPosters([]);
      }
    } catch (error) {
      setPosters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilteredPosters();
  }, [debouncedSearchTerm, page]);

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    setPage(1);
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
    <Container>
      <TextInput
        placeholder="Buscar un póster..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.currentTarget.value)}
        mb="md"
      />

      {/* Contenedor con scroll interno para la lista de pósters */}
      <Box
        style={{
          height: "1720px", // Altura máxima para el contenedor con scroll
          overflowY: "auto",
          marginBottom: "1rem",
        }}
      >
        {loading ? (
          <Loader size="lg" />
        ) : posters.length === 0 ? (
          <Text>No se encontraron pósters.</Text>
        ) : (
          <SimpleGrid cols={2} spacing="lg">
            {posters.map((poster) => renderPoster(poster))}
          </SimpleGrid>
        )}
      </Box>

      {/* Paginación fija debajo de la lista */}
      {posters.length > 0 && (
        <Group justify="space-around">
          <Button
            size="lg"
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || loading}
          >
            Anterior
          </Button>
          <Text fz="h3">
            Página {page} de {totalPages}
          </Text>
          <Button
          size="lg"
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
