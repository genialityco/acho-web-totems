import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Button,
  Loader,
  Modal,
  Box,
  Divider,
  TextInput,
  Group,
  Notification,
} from "@mantine/core";
import {
  fetchPosterById,
  Poster,
  searchPosters,
  voteForPoster,
} from "../services/api/posterService";
import { searchMembers } from "../services/api/memberService";

const PosterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poster, setPoster] = useState<Poster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [idNumber, setIdNumber] = useState<string>("");
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoster = async () => {
      try {
        if (!id) return;
        const response = await fetchPosterById(id);
        setPoster(response.data);
      } catch (error) {
        console.error("Error al obtener el póster:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoster();
  }, [id]);

  const handleVoteClick = () => {
    setIsVoteModalOpen(true);
  };

  const handleSearchMemberAndVote = async () => {
    if (!idNumber) {
      setVoteError("Por favor, ingresa un número de cédula.");
      return;
    }

    setIsVoting(true);
    setVoteError(null);

    try {
      // Buscar usuario por cédula
      const memberResponse = await searchMembers({
        "properties.idNumber": idNumber,
      });
      const member = memberResponse.data.items[0];

      if (!member) {
        setVoteError("No se encontró un usuario con esta cédula.");
        return;
      }

      const userId = member.userId;

      // Buscar si el usuario ya ha votado por un póster
      const posterResponse = await searchPosters({ voters: userId }) as { data: { items: Poster[] } };

      const votedPoster = posterResponse.data.items[0];

      if (votedPoster) {
        setVoteError(`Ya has votado por el póster: ${votedPoster.title}.`);
        return;
      }

      // Aquí implementa la lógica para registrar el voto si el usuario no ha votado aún
      await handleVoteForPoster(userId);
      setIsVoteModalOpen(false);
    } catch (error) {
      console.error("Error al buscar el usuario o registrar el voto:", error);
      setVoteError("Persona no habilitada para votar.");
    } finally {
      setIsVoting(false);
    }
  };

  const handleVoteForPoster = async (userId: string) => {
    try {
      if (!poster?._id) return;
      const response = await voteForPoster(poster?._id, userId);
      if (response.status === "success") {
        alert("Voto registrado exitosamente.");
        setIsVoteModalOpen(false);
      }
    } catch (error) {
      console.error("Error al votar por el póster:", error);
      setVoteError("Persona no habilitada para votar.");
    }
  };

  if (isLoading) {
    return (
      <Container
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Loader size="lg" />
        <Text ml="sm">Cargando póster...</Text>
      </Container>
    );
  }

  if (!poster) {
    return (
      <Container
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Text>No se encontró el póster.</Text>
      </Container>
    );
  }

  return (
    <Container
      size="xl"
      style={{
        paddingTop: "3rem",
        paddingBottom: "3rem",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Encabezado del póster */}
      <Box mb="xl" style={{ width: "100%", textAlign: "start" }}>
        <Text size="xl" fw={700} mb="xs">
          {poster.title}
        </Text>
        <Text size="md" c="dimmed" mb="xs">
          {poster.category} / {poster.topic}
        </Text>
        <Text size="md" c="dimmed">
          Autor(es): {poster.authors.join(", ")}
        </Text>
      </Box>

      <Divider mb="xl" style={{ width: "100%" }} />

      {/* Botón para votar por el póster */}
      <Button
        variant="light"
        color="blue"
        size="lg"
        mb="md"
        onClick={handleVoteClick}
      >
        Votar por este póster
      </Button>

      {/* Botón para ver en pantalla completa */}
      <Button
        variant="filled"
        color="blue"
        size="lg"
        onClick={() => setIsFullScreen(true)}
        mb="lg"
      >
        Ver en pantalla completa
      </Button>

      {/* Botón para regresar a la lista de pósters */}
      <Button
        variant="outline"
        color="gray"
        size="lg"
        onClick={() => navigate("/")}
        mb="lg"
      >
        Volver a la lista de pósters
      </Button>

      {/* Previsualización del PDF */}
      <Box
        style={{
          width: "100%",
          height: "1300px",
          border: "1px solid #eaeaea",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "2rem",
        }}
      >
        <iframe
          src={poster.urlPdf}
          title="Previsualización del PDF"
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Box>

      {/* Modal para ingresar cédula y votar */}
      <Modal
        opened={isVoteModalOpen}
        centered
        size="lg"
        onClose={() => setIsVoteModalOpen(false)}
        title="Votar por el póster"
      >
        <TextInput
          label="Número de Cédula"
          placeholder="Ingresa tu número de cédula"
          size="lg"
          value={idNumber}
          onChange={(e) => setIdNumber(e.currentTarget.value)}
        />
        <Group justify="flex-start" mt="md">
          <Button size="lg" onClick={handleSearchMemberAndVote} loading={isVoting}>
            Confirmar Voto
          </Button>
        </Group>
        {voteError && (
          <Notification color="red" mt="md">
            <Text size="lg">{voteError}</Text>
          </Notification>
        )}
      </Modal>

      {/* Modal para ver en pantalla completa */}
      <Modal
        opened={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        fullScreen
        padding="sm"
      >
        <iframe
          src={poster.urlPdf}
          title="Póster en pantalla completa"
          style={{ width: "100%", height: "1980px", border: "none" }}
        />
      </Modal>
    </Container>
  );
};

export default PosterDetail;
