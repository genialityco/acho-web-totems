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
  Flex,
} from "@mantine/core";
import {
  fetchPosterById,
  Poster,
  searchPosters,
  voteForPoster,
} from "../services/api/posterService";
import { searchMembers } from "../services/api/memberService";
import { usePosters } from "../context/PostersContext";
import "./PosterDetail.css";

const PosterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentPagePosters } = usePosters();
  const [poster, setPoster] = useState<Poster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [idNumber, setIdNumber] = useState<string>("");
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [showQrCodes, setShowQrCodes] = useState(false); // Estado para mostrar los QR
  const [showModalSuccess, setShowModalSuccess] = useState(false); // Estado para mostrar el modal de éxito
  const [showVotedInfo, setShowVotedInfo] = useState(false); // Estado para mostrar la información de voto

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
        setVoteError(
          "No se encontró un usuario con esta cédula. Regístrate en la App para poder votar."
        );
        setShowQrCodes(true);
        return;
      }
      if (!member.memberActive) {
        setVoteError(
          "No se encontró un usuario con esta cédula. Regístrate en la App para poder votar."
        );
        setShowQrCodes(true);
        return;
      }
      const userId = member.userId;
      const posterResponse = (await searchPosters({ voters: userId })) as {
        data: { items: Poster[] };
      };
      const votedPoster = posterResponse?.data?.items[0];
      if (votedPoster) {
        setVoteError(`Ya has votado por el póster: ${votedPoster.title}.`);
        setShowVotedInfo(true);
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
        setShowModalSuccess(true);
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
      <Text c="dimmed" style={{ marginTop: -15 }}>
        {poster.topic} / {poster.category}
      </Text>
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
        {showVotedInfo && (
          <Flex direction="column" align="center" mt="lg">
            <Text size="lg" ta="center" variant="h2" c="green">
              ¡Ya has votado!
            </Text>
            <Text mt="md" ta="center">
              ¡Gracias por tu participación!
            </Text>
            <Text mt="md" ta="center">
              Puedes seguir viendo los posters desde la aplicación de la ACHO,
              donde también encontrarás el programa del congreso, tus
              certificado de asistencia y novedades de la asociación. Usa los
              siguientes QR para instalarla.
            </Text>
            <Group justify="center" mt="md">
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrios.jpeg"
                alt="QR 1"
                width={100}
                height={100}
                style={{ marginRight: "150px" }}
              />
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrandroid.jpeg"
                alt="QR 2"
                width={100}
                height={100}
              />
            </Group>
            <Text>Si sigues teniendo dificultades comunicate con soporte.</Text>
          </Flex>
        )}
        {showQrCodes && (
          <Box mt="lg" style={{ textAlign: "center" }}>
            <Text>
              Escanea cualquiera de los siguientes códigos QR para descargar la
              aplicación de ACHO:
            </Text>
            <Group justify="center" mt="md">
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrios.jpeg"
                alt="QR 1"
                width={100}
                height={100}
                style={{ marginRight: "150px" }}
              />
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrandroid.jpeg"
                alt="QR 2"
                width={100}
                height={100}
              />
            </Group>
            <Text>Si sigues teniendo dificultades comunicate con soporte.</Text>
          </Box>
        )}
      </Modal>

      <Modal
        opened={showModalSuccess}
        onClose={() => setShowModalSuccess(false)}
      >
        <Text size="lg" ta="center" variant="h1" c="green">
          ¡Voto registrado exitosamente!
        </Text>
        <Text mt="md" ta="center">
          ¡Gracias por tu participación!
        </Text>
        <Text size="lg" variant="h1" mt="md" ta="center">
          Puedes seguir viendo los posters desde la aplicación de la ACHO, donde
          también encontrarás el programa del congreso, tus certificado de
          asistencia y novedades de la asociación. Usa los siguientes QR para
          instalarla.
        </Text>
        <Group justify="center" mt="md">
          <img
            src="https://ik.imagekit.io/6cx9tc1kx/qrios.jpeg"
            alt="QR 1"
            width={100}
            height={100}
            style={{ marginRight: "150px" }}
          />
          <img
            src="https://ik.imagekit.io/6cx9tc1kx/qrandroid.jpeg"
            alt="QR 2"
            width={100}
            height={100}
          />
        </Group>
        <Text>Si sigues teniendo dificultades comunicate con soporte.</Text>
      </Modal>
    </Container>
  );
};

export default PosterDetail;
