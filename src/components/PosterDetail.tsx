import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Button,
  Loader,
  Modal,
  Group,
  TextInput,
  Notification,
  Text,
  Flex,
} from "@mantine/core";
import { IconArrowsMaximize, IconArrowsMinimize, IconDownload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { castVote, VoteError } from "../services/firestore/voteService";
import { usePosters } from "../context/usePosters";
import { useElementFullscreen } from "../hooks/useElementFullscreen";
import { slugify } from "../utils/text";
import "./PosterDetail.css";

const pdfFileName = (title: string) => `${slugify(title).slice(0, 100) || "poster"}.pdf`;

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
  const [showModalSuccess, setShowModalSuccess] = useState(false); // Estado para mostrar el modal de éxito
  const [showVotedInfo, setShowVotedInfo] = useState(false); // Estado para mostrar la información de voto
  const [isDownloading, setIsDownloading] = useState(false);

  const currentIndex = currentPagePosters.findIndex((p) => p.id === id);
  const votingClosed = event?.votingOpen === false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isOverlay, toggle: toggleFullscreen } = useElementFullscreen(viewerRef);

  // El visor de PDF es un iframe de otro origen: la actividad del mouse/teclado dentro de
  // él no llega a este window, así que el detector de inactividad del protector de pantalla
  // (que escucha en window) no se entera. Mientras el foco quede en el iframe, simulamos
  // actividad cada 5s para que alguien leyendo un poster no sea interrumpido a mitad de lectura.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const handleBlur = () => {
      interval = setInterval(() => {
        if (document.activeElement === iframeRef.current) {
          window.dispatchEvent(new Event("mousemove"));
        }
      }, 5000);
    };
    const handleFocus = () => {
      if (interval) clearInterval(interval);
    };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleVoteClick = () => setIsVoteModalOpen(true);

  // Descarga directa: baja el PDF como blob y lo guarda con el título del póster como nombre. Solo
  // funciona si el CORS del bucket permite el origen de la app (ver CLAUDE.md); si no —ej. localhost,
  // o un PDF alojado fuera de Storage— el fetch falla y se abre el PDF directo (el navegador lo
  // descarga o lo muestra en otra pestaña). Ctrl/Cmd/Shift + clic dejan actuar al enlace normal.
  const handleDownload = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!poster || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    setIsDownloading(true);
    try {
      const response = await fetch(poster.urlPdf);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = pdfFileName(poster.title);
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch {
      // Tras el await ya no hay gesto del usuario y el navegador puede bloquear la pestaña nueva:
      // en ese caso se navega en la misma pestaña, que nunca se bloquea.
      const opened = window.open(poster.urlPdf, "_blank");
      if (opened) opened.opener = null;
      else window.location.assign(poster.urlPdf);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirmVote = async () => {
    const cedula = idNumber.trim();
    if (!cedula) {
      setVoteError(t("posterDetail.idNumberRequired"));
      return;
    }
    if (!poster) return;

    setIsVoting(true);
    setVoteError(null);
    setShowVotedInfo(false);
    try {
      await castVote({ eventSlug, idNumber: cedula, paperId: poster.id });
      setIsVoteModalOpen(false);
      setIdNumber("");
      setShowModalSuccess(true);
    } catch (error) {
      if (error instanceof VoteError && error.code === "not-found") {
        setVoteError(t("posterDetail.voterNotFound"));
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

      <div
        ref={viewerRef}
        className={isOverlay ? "posterViewer posterViewer--overlay" : "posterViewer"}
      >
        <Group className="posterViewerToolbar" justify="flex-end" gap="xs">
          {/* El href es el respaldo (clic con modificador, o si handleDownload no puede leer el archivo). */}
          <Button
            component="a"
            href={poster.urlPdf}
            download={pdfFileName(poster.title)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDownload}
            loading={isDownloading}
            size="xs"
            variant="default"
            leftSection={<IconDownload size={16} />}
          >
            {t("posterDetail.download")}
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={toggleFullscreen}
            leftSection={isFullscreen ? <IconArrowsMinimize size={16} /> : <IconArrowsMaximize size={16} />}
          >
            {isFullscreen ? t("posterDetail.exitFullscreen") : t("posterDetail.fullscreen")}
          </Button>
        </Group>
        <iframe
          ref={iframeRef}
          className="posterViewerFrame"
          src={`https://genpdfviewer.netlify.app/?file=${encodeURIComponent(poster.urlPdf)}`}
          title={t("posterDetail.posterIframeTitle")}
          allowFullScreen
        />
      </div>

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
          </Flex>
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
      </Modal>
    </Container>
  );
};

export default PosterDetail;
