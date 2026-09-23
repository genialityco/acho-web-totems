import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Center,
  Code,
  FileInput,
  Group,
  Image,
  Loader,
  Modal,
  Progress,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink, IconPencil, IconPhoto, IconTrash } from "@tabler/icons-react";
import { AdminEventProvider } from "../../context/AdminEventContext";
import { useAdminEvent } from "../../context/useAdminEvent";
import { EventInfo, updateEvent } from "../../services/firestore/eventService";
import { errorMessage } from "../../services/firestore/batch";
import { deleteEventImage, MAX_EVENT_IMAGE_BYTES, uploadEventImage } from "../../services/storageService";

function EventImageField({
  label,
  description,
  currentUrl,
  file,
  onFileChange,
  removed,
  onRemove,
  progress,
  disabled,
}: {
  label: string;
  description: string;
  currentUrl: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  removed: boolean;
  onRemove: () => void;
  progress: number | null;
  disabled: boolean;
}) {
  return (
    <Stack gap={4}>
      <FileInput
        label={label}
        description={description}
        placeholder="Seleccionar imagen..."
        accept="image/*"
        leftSection={<IconPhoto size={16} />}
        value={file}
        onChange={onFileChange}
        clearable
        disabled={disabled}
      />
      {currentUrl && !removed && (
        <Text size="xs" c="dimmed">
          Deja vacío para conservar la imagen actual.
        </Text>
      )}
      {currentUrl && !file && !removed && (
        <Group gap="xs">
          <Image src={currentUrl} h={50} w="auto" fit="contain" radius="sm" />
          <Tooltip label="Quitar imagen">
            <ActionIcon variant="subtle" color="red" aria-label={`Quitar ${label.toLowerCase()}`} onClick={onRemove}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
      {progress !== null && <Progress value={progress} animated />}
    </Stack>
  );
}

function EditEventModal({
  event,
  onClose,
}: {
  event: EventInfo;
  onClose: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [bannerProgress, setBannerProgress] = useState<number | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [backgroundProgress, setBackgroundProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (bannerFile && bannerFile.size > MAX_EVENT_IMAGE_BYTES) {
      return setError("La imagen del banner no puede superar los 5 MB.");
    }
    if (backgroundFile && backgroundFile.size > MAX_EVENT_IMAGE_BYTES) {
      return setError("La imagen de fondo no puede superar los 5 MB.");
    }

    setSaving(true);
    setError(null);
    try {
      const previousBannerUrl = event.bannerUrl;
      const previousBackgroundUrl = event.backgroundUrl;
      let bannerUrl = previousBannerUrl;
      let backgroundUrl = previousBackgroundUrl;

      if (bannerFile) {
        setBannerProgress(0);
        bannerUrl = await uploadEventImage(event.slug, "banner", bannerFile, setBannerProgress).promise;
      } else if (removeBanner) {
        bannerUrl = null;
      }

      if (backgroundFile) {
        setBackgroundProgress(0);
        backgroundUrl = await uploadEventImage(event.slug, "background", backgroundFile, setBackgroundProgress).promise;
      } else if (removeBackground) {
        backgroundUrl = null;
      }

      await updateEvent(event.slug, { name: name.trim(), bannerUrl, backgroundUrl });

      if (previousBannerUrl && previousBannerUrl !== bannerUrl) {
        // El evento ya quedó guardado con la imagen nueva (o sin imagen); la anterior es basura en Storage.
        deleteEventImage(previousBannerUrl).catch((err) => console.error("No se pudo borrar el banner anterior:", err));
      }
      if (previousBackgroundUrl && previousBackgroundUrl !== backgroundUrl) {
        deleteEventImage(previousBackgroundUrl).catch((err) => console.error("No se pudo borrar el fondo anterior:", err));
      }

      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      setBannerProgress(null);
      setBackgroundProgress(null);
    }
  };

  return (
    <Modal opened onClose={onClose} title="Editar evento" centered closeOnClickOutside={!saving} withCloseButton={!saving}>
      <Stack>
        <TextInput label="Nombre" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <EventImageField
          label="Imagen del banner"
          description="Cabecera del sitio público: ocupa el 100% del ancho y su alto se ajusta entre 80 y 200px según la pantalla. Tamaño ideal: 2000×200 px (horizontal, relación ~10:1) para que no se recorte en alto en desktop. Máx. 5 MB. Vacío = logo de ACHO por defecto."
          currentUrl={event.bannerUrl}
          file={bannerFile}
          onFileChange={(f) => {
            setBannerFile(f);
            if (f) setRemoveBanner(false);
          }}
          removed={removeBanner}
          onRemove={() => setRemoveBanner(true)}
          progress={bannerProgress}
          disabled={saving}
        />
        <EventImageField
          label="Imagen de fondo"
          description="Fondo de todo el sitio público del evento (cabecera y contenido), cubre la pantalla completa. Tamaño ideal: 1920×1080 px o más (horizontal). Máx. 5 MB. Vacío = sin fondo."
          currentUrl={event.backgroundUrl}
          file={backgroundFile}
          onFileChange={(f) => {
            setBackgroundFile(f);
            if (f) setRemoveBackground(false);
          }}
          removed={removeBackground}
          onRemove={() => setRemoveBackground(true)}
          progress={backgroundProgress}
          disabled={saving}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

const TABS = [
  { value: "categories", label: "Categorías" },
  { value: "papers", label: "Papers" },
  { value: "voters", label: "Votantes" },
  { value: "results", label: "Resultados" },
  { value: "screensaver", label: "Protector de pantalla" },
];

function EventFrame() {
  const { eventSlug, status, event } = useAdminEvent();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const backLink = (
    <Anchor component={Link} to="/admin" size="sm">
      <Group gap={4}>
        <IconArrowLeft size={14} />
        Eventos
      </Group>
    </Anchor>
  );

  if (status === "loading") {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }
  if (status === "not-found" || status === "error" || !event) {
    return (
      <Stack gap="sm">
        {backLink}
        <Alert color="red">
          {status === "not-found"
            ? "No existe un evento con ese identificador."
            : "No se pudo cargar el evento. Verifica tu conexión y tus permisos."}
        </Alert>
      </Stack>
    );
  }

  const segment = location.pathname.split("/")[3] ?? "";
  const activeTab = TABS.some((t) => t.value === segment) ? segment : "categories";

  const toggleVoting = async (open: boolean) => {
    setError(null);
    try {
      await updateEvent(eventSlug, { votingOpen: open });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el estado de la votación.");
    }
  };

  return (
    <Stack gap="md">
      {backLink}
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            <Title order={3}>{event.name}</Title>
            <Tooltip label="Editar evento">
              <ActionIcon variant="subtle" aria-label="Editar evento" onClick={() => setEditing(true)}>
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group gap="xs">
            <Code>/{eventSlug}</Code>
            <Anchor href={`/${eventSlug}`} target="_blank" rel="noreferrer" size="sm">
              <Group gap={4}>
                Ver sitio público
                <IconExternalLink size={14} />
              </Group>
            </Anchor>
          </Group>
        </Stack>
        <Stack gap={2} align="flex-end">
          <Switch
            size="md"
            checked={event.votingOpen}
            onChange={(e) => void toggleVoting(e.currentTarget.checked)}
            label={event.votingOpen ? "Votación abierta" : "Votación cerrada"}
          />
          <Text size="xs" c="dimmed">
            Cuando está cerrada nadie puede votar.
          </Text>
        </Stack>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      <Tabs value={activeTab} onChange={(value) => value && navigate(`/admin/${eventSlug}/${value}`)}>
        <Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Outlet />

      {editing && <EditEventModal event={event} onClose={() => setEditing(false)} />}
    </Stack>
  );
}

export default function AdminEventLayout() {
  const { eventSlug = "" } = useParams<{ eventSlug: string }>();

  // key reinicia las suscripciones al cambiar de evento
  return (
    <AdminEventProvider key={eventSlug} eventSlug={eventSlug}>
      <EventFrame />
    </AdminEventProvider>
  );
}
