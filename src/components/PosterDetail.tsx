import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Button,
  Loader,
  Modal,
  Group,
  TextInput,
  Notification,
  Box,
  Text,
} from "@mantine/core";
import {
  fetchPosterById,
  Poster,
  searchPosters,
  voteForPoster,
} from "../services/api/posterService";
import { searchMembers } from "../services/api/memberService";
import { usePosters } from "../context/PostersContext";
import './PosterDetail.css';

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
        <span>Cargando póster...</span>
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
        <span>No se encontró el póster.</span>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Text c="dimmed" style={{marginTop: -15}}>
        {poster.topic} / {poster.category}
      </Text>
      {/* Botones de navegación y votar */}
      <Group justify="space-around" mb="md">
        <Button
          variant="light"
          color="blue"
          size="lg"
          onClick={handleVoteClick}
          className="pulse-button"
        >
          Votar por este póster
        </Button>
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

      {/* Iframe de visualización del póster */}
      <Box
        style={{
          width: "100%",
          height: "85vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "white",
        }}
      >
        <iframe
          src={`https://genpdfviewer.netlify.app/?file=${poster.urlPdf}`}
          title="Póster"
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Box>

      {/* Modal para votar */}
      <Modal
        opened={isVoteModalOpen}
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
            {voteError}
          </Notification>
        )}
      </Modal>

      {/* Modal para pantalla completa */}
      <Modal
        opened={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        fullScreen
        padding="sm"
      >
        <iframe
          src={poster.urlPdf}
          title="Póster en pantalla completa"
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Modal>
    </Container>
  );
};

export default PosterDetail;
