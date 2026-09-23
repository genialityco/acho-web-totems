import { useState } from "react";
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
import { useTranslation } from "react-i18next";
import { castVote, VoteError } from "../services/firestore/voteService";
import { usePosters } from "../context/usePosters";
import "./PosterDetail.css";

const PosterDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { eventSlug, event, posters, currentPagePosters, loading, getCategoryName } =
    usePosters();
  const poster = posters.find((p) => p.id === id) ?? null;
  const [isVoting, setIsVoting] = useState(false);
  const [idNumber, setIdNumber] = useState<string>("");
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [showQrCodes, setShowQrCodes] = useState(false); // Estado para mostrar los QR
  const [showModalSuccess, setShowModalSuccess] = useState(false); // Estado para mostrar el modal de éxito
  const [showVotedInfo, setShowVotedInfo] = useState(false); // Estado para mostrar la información de voto

  const currentIndex = currentPagePosters.findIndex((p) => p.id === id);
  const votingClosed = event?.votingOpen === false;

  const handleVoteClick = () => setIsVoteModalOpen(true);

  const handleConfirmVote = async () => {
    const cedula = idNumber.trim();
    if (!cedula) {
      setVoteError(t("posterDetail.idNumberRequired"));
      return;
    }
    if (!poster) return;

    setIsVoting(true);
    setVoteError(null);
    setShowQrCodes(false);
    setShowVotedInfo(false);
    try {
      await castVote({ eventSlug, idNumber: cedula, paperId: poster.id });
      setIsVoteModalOpen(false);
      setIdNumber("");
      setShowModalSuccess(true);
    } catch (error) {
      if (error instanceof VoteError && error.code === "not-found") {
        setVoteError(t("posterDetail.voterNotFound"));
        setShowQrCodes(true);
      } else if (error instanceof VoteError && error.code === "already-exists") {
        setVoteError(
          error.paperTitle
            ? t("posterDetail.alreadyVotedFor", { title: error.paperTitle })
            : t("posterDetail.alreadyVotedGeneric")
        );
        setShowVotedInfo(true);
      } else if (error instanceof VoteError && error.code === "failed-precondition") {
        setVoteError(t("posterDetail.votingClosedError"));
      } else {
        console.error("Error al registrar el voto:", error);
        setVoteError(t("posterDetail.voteError"));
      }
    } finally {
      setIsVoting(false);
    }
  };

  if (loading) {
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
        <span>{t("posterDetail.loading")}</span>
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
        <span>{t("posterDetail.notFound")}</span>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Text c="dimmed" style={{ marginTop: -15 }}>
        {[getCategoryName(poster.categoryId), poster.theme].filter(Boolean).join(" / ")}
      </Text>
      <Group justify="space-around" mb="md">
        <Button
          variant="light"
          color="blue"
          size="lg"
          onClick={handleVoteClick}
          className={votingClosed ? undefined : "pulse-button"}
          disabled={votingClosed}
        >
          {votingClosed ? t("posterDetail.voteClosed") : t("posterDetail.voteOpen")}
        </Button>
        <Button
          size="md"
          onClick={() =>
            navigate(`/${eventSlug}/paper/${currentPagePosters[currentIndex - 1]?.id}`)
          }
          disabled={currentIndex <= 0}
        >
          {t("common.previous")}
        </Button>
        <Button size="md" onClick={() => navigate(`/${eventSlug}`)}>
          {t("posterDetail.backToList")}
        </Button>
        <Button
          size="md"
          onClick={() =>
            navigate(`/${eventSlug}/paper/${currentPagePosters[currentIndex + 1]?.id}`)
          }
          disabled={currentIndex >= currentPagePosters.length - 1}
        >
          {t("common.next")}
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
          title={t("posterDetail.posterIframeTitle")}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Box>

      {/* Modal para votar */}
      <Modal
        opened={isVoteModalOpen}
        size="lg"
        onClose={() => setIsVoteModalOpen(false)}
        title={t("posterDetail.voteModalTitle")}
      >
        <TextInput
          label={t("posterDetail.idNumberLabel")}
          placeholder={t("posterDetail.idNumberPlaceholder")}
          size="lg"
          value={idNumber}
          onChange={(e) => setIdNumber(e.currentTarget.value)}
        />
        <Group justify="flex-start" mt="md">
          <Button size="lg" onClick={handleConfirmVote} loading={isVoting}>
            {t("posterDetail.confirmVote")}
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
              {t("posterDetail.alreadyVotedTitle")}
            </Text>
            <Text mt="md" ta="center">
              {t("posterDetail.thanksForParticipating")}
            </Text>
            <Text mt="md" ta="center">
              {t("posterDetail.appPromo")}
            </Text>
            <Group justify="center" mt="md">
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrios.jpeg"
                alt={t("posterDetail.qrAlt1")}
                width={100}
                height={100}
                style={{ marginRight: "150px" }}
              />
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrandroid.jpeg"
                alt={t("posterDetail.qrAlt2")}
                width={100}
                height={100}
              />
            </Group>
            <Text>{t("posterDetail.supportContact")}</Text>
          </Flex>
        )}
        {showQrCodes && (
          <Box mt="lg" style={{ textAlign: "center" }}>
            <Text>{t("posterDetail.scanQr")}</Text>
            <Group justify="center" mt="md">
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrios.jpeg"
                alt={t("posterDetail.qrAlt1")}
                width={100}
                height={100}
                style={{ marginRight: "150px" }}
              />
              <img
                src="https://ik.imagekit.io/6cx9tc1kx/qrandroid.jpeg"
                alt={t("posterDetail.qrAlt2")}
                width={100}
                height={100}
              />
            </Group>
            <Text>{t("posterDetail.supportContact")}</Text>
          </Box>
        )}
      </Modal>

      <Modal
        opened={showModalSuccess}
        onClose={() => setShowModalSuccess(false)}
      >
        <Text size="lg" ta="center" variant="h1" c="green">
          {t("posterDetail.voteSuccessTitle")}
        </Text>
        <Text mt="md" ta="center">
          {t("posterDetail.thanksForParticipating")}
        </Text>
        <Text size="lg" variant="h1" mt="md" ta="center">
          {t("posterDetail.appPromo")}
        </Text>
        <Group justify="center" mt="md">
          <img
            src="https://ik.imagekit.io/6cx9tc1kx/qrios.jpeg"
            alt={t("posterDetail.qrAlt1")}
            width={100}
            height={100}
            style={{ marginRight: "150px" }}
          />
          <img
            src="https://ik.imagekit.io/6cx9tc1kx/qrandroid.jpeg"
            alt={t("posterDetail.qrAlt2")}
            width={100}
            height={100}
          />
        </Group>
        <Text>{t("posterDetail.supportContact")}</Text>
      </Modal>
    </Container>
  );
};

export default PosterDetail;
