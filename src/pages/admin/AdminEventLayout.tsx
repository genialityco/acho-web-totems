import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Center,
  Code,
  Group,
  Loader,
  Modal,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink, IconPencil } from "@tabler/icons-react";
import { AdminEventProvider } from "../../context/AdminEventContext";
import { useAdminEvent } from "../../context/useAdminEvent";
import { EventInfo, updateEvent } from "../../services/firestore/eventService";
import { errorMessage } from "../../services/firestore/batch";
import { isHttpUrl } from "../../utils/text";

type EventSettings = Pick<EventInfo, "name" | "bannerUrl" | "backgroundUrl">;

function EditEventModal({
  event,
  onClose,
}: {
  event: EventInfo;
  onClose: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [bannerUrl, setBannerUrl] = useState(event.bannerUrl ?? "");
  const [backgroundUrl, setBackgroundUrl] = useState(event.backgroundUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (bannerUrl.trim() && !isHttpUrl(bannerUrl.trim())) {
      return setError("La URL del banner debe empezar por http:// o https://");
    }
    if (backgroundUrl.trim() && !isHttpUrl(backgroundUrl.trim())) {
      return setError("La URL del fondo debe empezar por http:// o https://");
    }
    setSaving(true);
    setError(null);
    try {
      const changes: Partial<EventSettings> = {
        name: name.trim(),
        bannerUrl: bannerUrl.trim() || null,
        backgroundUrl: backgroundUrl.trim() || null,
      };
      await updateEvent(event.slug, changes);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title="Editar evento" centered>
      <Stack>
        <TextInput label="Nombre" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <TextInput
          label="Imagen del banner"
          description="Se muestra en la cabecera del sitio público. Vacío = logo de ACHO por defecto."
          placeholder="https://..."
          value={bannerUrl}
          onChange={(e) => setBannerUrl(e.currentTarget.value)}
        />
        <TextInput
          label="Imagen de fondo del landing"
          description="Fondo de la página principal del evento (donde se listan los papers). Vacío = sin fondo."
          placeholder="https://..."
          value={backgroundUrl}
          onChange={(e) => setBackgroundUrl(e.currentTarget.value)}
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
