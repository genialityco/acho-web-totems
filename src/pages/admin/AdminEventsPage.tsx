import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
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
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import {
  createEvent,
  EventInfo,
  subscribeEvents,
  updateEvent,
} from "../../services/firestore/eventService";
import { slugify } from "../../utils/text";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// "admin" es una ruta estática y taparía el evento.
const RESERVED_SLUGS = ["admin"];

function CreateEventModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (slug.length < 3 || slug.length > 60 || !SLUG_PATTERN.test(slug)) {
      return setError(
        "El identificador debe tener entre 3 y 60 caracteres: letras minúsculas, números y guiones (sin espacios ni tildes)."
      );
    }
    if (RESERVED_SLUGS.includes(slug)) return setError(`"${slug}" es un identificador reservado.`);
    setSaving(true);
    setError(null);
    try {
      await createEvent(slug, name.trim());
      navigate(`/admin/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el evento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Nuevo evento" centered>
      <Stack>
        <TextInput
          label="Nombre"
          placeholder="Congreso ACHO 2026"
          value={name}
          onChange={(e) => handleNameChange(e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          label="Identificador (URL)"
          description={`El sitio público quedará en /${slug || "identificador"}. No se puede cambiar después.`}
          value={slug}
          onChange={(e) => {
            setSlug(e.currentTarget.value);
            setSlugEdited(true);
          }}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            Crear evento
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(
    () =>
      subscribeEvents(setEvents, (e) => {
        console.error(e);
        setError("No se pudieron cargar los eventos.");
      }),
    []
  );

  const toggleVoting = async (event: EventInfo, open: boolean) => {
    setError(null);
    try {
      await updateEvent(event.slug, { votingOpen: open });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el estado de la votación.");
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Eventos</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          Nuevo evento
        </Button>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      {events === null && !error ? (
        <Center h={200}>
          <Loader />
        </Center>
      ) : events && events.length === 0 ? (
        <Text c="dimmed">Aún no hay eventos. Crea el primero con "Nuevo evento".</Text>
      ) : (
        events && (
          <Table.ScrollContainer minWidth={600}>
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Sitio público</Table.Th>
                  <Table.Th>Votación</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {events.map((event) => (
                  <Table.Tr key={event.slug}>
                    <Table.Td>{event.name}</Table.Td>
                    <Table.Td>
                      <Anchor href={`/${event.slug}`} target="_blank" rel="noreferrer">
                        <Code>/{event.slug}</Code>
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={event.votingOpen}
                        onChange={(e) => void toggleVoting(event, e.currentTarget.checked)}
                        label={event.votingOpen ? "Abierta" : "Cerrada"}
                        aria-label={`Votación de ${event.name}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Button component={Link} to={`/admin/${event.slug}`} size="xs" variant="light">
                        Administrar
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )
      )}

      {createOpen && <CreateEventModal opened onClose={() => setCreateOpen(false)} />}
    </Stack>
  );
}
