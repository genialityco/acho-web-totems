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
import { usePosters } from "../context/PostersContext";

const PosterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentPagePosters } = usePosters();
  const [poster, setPoster] = useState<Poster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [idNumber, setIdNumber] = useState<string>("");
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Index del póster actual dentro de la lista filtrada para navegación
  const currentIndex = currentPagePosters.findIndex((p) => p._id === id);

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

  const handleVoteClick = () => setIsVoteModalOpen(true);

  const handleSearchMemberAndVote = async () => {
    if (!idNumber) {
      setVoteError("Por favor, ingresa un número de cédula.");
      return;
    }
    setIsVoting(true);
    setVoteError(null);
    try {
      const memberResponse = await searchMembers({
        "properties.idNumber": idNumber,
      });
      const member = memberResponse?.data?.items[0];
      if (!member) {
        setVoteError("No se encontró un usuario con esta cédula.");
        return;
      }
      if (!member.memberActive) {
        setVoteError("La persona no está habilitada para votar.");
        return;
      }
      const userId = member.userId;
      const posterResponse = (await searchPosters({ voters: userId })) as {
        data: { items: Poster[] };
      };
      const votedPoster = posterResponse?.data?.items[0];
      if (votedPoster) {
        setVoteError(`Ya has votado por el póster: ${votedPoster.title}.`);
        return;
      }
      await handleVoteForPoster(userId);
      setIsVoteModalOpen(false);
      setIdNumber("");
    } catch (error) {
      console.error("Error al buscar el usuario o registrar el voto:", error);
      setVoteError("Hubo un error al procesar tu voto. Intenta de nuevo.");
    } finally {
      setIsVoting(false);
    }
  };

  const handleVoteForPoster = async (userId: string) => {
    try {
      if (!poster?._id) return;
      const response = await voteForPoster(poster._id, userId);
      if (response.status === "success") {
        alert("Voto registrado exitosamente.");
      }
    } catch (error) {
      console.error("Error al votar por el póster:", error);
      setVoteError("Hubo un error al procesar tu voto. Intenta de nuevo.");
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
    <Container size="md" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
      <Box mb="xl" style={{ textAlign: "start" }}>
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

      <Divider mb="xl" />

      <Button
        variant="light"
        color="blue"
        size="lg"
        mb="md"
        onClick={handleVoteClick}
      >
        Votar por este póster
      </Button>

      <Box
        style={{
          width: "100%",
          height: "75vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          border: "1px solid #eaeaea",
          borderRadius: "8px",
          marginBottom: "2rem",
        }}
      >
        <iframe
          src={`https://drive.google.com/viewerng/viewer?embedded=true&url=${poster.urlPdf}`}
          title="Previsualización del PDF"
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Box>

      <Group justify="space-around">
        <Button
          size="md"
          onClick={() =>
            navigate(`/poster/${currentPagePosters[currentIndex - 1]?._id}`)
          }
          disabled={currentIndex <= 0}
        >
          Anterior
        </Button>
        <Button size="md" onClick={() => navigate("/")}>
          Volver a la lista
        </Button>
        <Button
          size="md"
          onClick={() =>
            navigate(`/poster/${currentPagePosters[currentIndex + 1]?._id}`)
          }
          disabled={currentIndex >= currentPagePosters.length - 1}
        >
          Siguiente
        </Button>
      </Group>

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
          <Button
            size="lg"
            onClick={handleSearchMemberAndVote}
            loading={isVoting}
          >
            Confirmar Voto
          </Button>
        </Group>
        {voteError && (
          <Notification color="red" mt="md">
            <Text size="lg">{voteError}</Text>
          </Notification>
        )}
      </Modal>

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
