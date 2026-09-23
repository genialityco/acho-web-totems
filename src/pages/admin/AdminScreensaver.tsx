import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Image,
  Modal,
  NumberInput,
  Progress,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconPhoto, IconPlus, IconTrash, IconVideo } from "@tabler/icons-react";
import ConfirmModal from "../../components/admin/ConfirmModal";
import { useAdminEvent } from "../../context/useAdminEvent";
import { EventInfo, updateEvent } from "../../services/firestore/eventService";
import {
  ScreensaverItem,
  ScreensaverItemInput,
  createScreensaverItem,
  deleteScreensaverItem,
  updateScreensaverItem,
} from "../../services/firestore/screensaverService";
import { deleteScreensaverMedia, MAX_SCREENSAVER_MEDIA_BYTES, uploadScreensaverMedia } from "../../services/storageService";
import { errorMessage } from "../../services/firestore/batch";

function ScreensaverSettings({ eventSlug, event }: { eventSlug: string; event: EventInfo }) {
  const [idleSeconds, setIdleSeconds] = useState(event.screensaverIdleSeconds);
  const [photoSeconds, setPhotoSeconds] = useState(event.screensaverPhotoDurationSeconds);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdleSeconds(event.screensaverIdleSeconds);
    setPhotoSeconds(event.screensaverPhotoDurationSeconds);
  }, [event.screensaverIdleSeconds, event.screensaverPhotoDurationSeconds]);

  const toggleEnabled = async (checked: boolean) => {
    setToggling(true);
    setError(null);
    try {
      await updateEvent(eventSlug, { screensaverEnabled: checked });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const handleSaveTimings = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateEvent(eventSlug, {
        screensaverIdleSeconds: idleSeconds,
        screensaverPhotoDurationSeconds: photoSeconds,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    idleSeconds !== event.screensaverIdleSeconds || photoSeconds !== event.screensaverPhotoDurationSeconds;

  return (
    <Card withBorder padding="lg">
      <Stack>
        <Switch
          label="Protector de pantalla activo"
          description="Se activa en el sitio público tras el tiempo de inactividad configurado."
          checked={event.screensaverEnabled}
          onChange={(e) => void toggleEnabled(e.currentTarget.checked)}
          disabled={toggling}
        />
        <Group align="flex-end">
          <NumberInput
            label="Segundos de inactividad"
            description="Tiempo sin interacción antes de activarse."
            min={10}
            value={idleSeconds}
            onChange={(v) => setIdleSeconds(typeof v === "number" ? v : Number(v) || 10)}
          />
          <NumberInput
            label="Segundos por foto"
            description="Los videos avanzan solos al terminar."
            min={1}
            value={photoSeconds}
            onChange={(v) => setPhotoSeconds(typeof v === "number" ? v : Number(v) || 1)}
          />
          <Button onClick={handleSaveTimings} loading={saving} disabled={!dirty}>
            Guardar
          </Button>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </Card>
  );
}

function ScreensaverItemFormModal({
  item,
  nextOrder,
  eventSlug,
  onClose,
  onSave,
}: {
  item: ScreensaverItem | null;
  nextOrder: number;
  eventSlug: string;
  onClose: () => void;
  onSave: (input: ScreensaverItemInput) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState<number>(nextOrder);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFile(null);
    setOrder(item?.order ?? nextOrder);
    setError(null);
    setUploadProgress(null);
  }, [item, nextOrder]);

  const handleSubmit = async () => {
    if (!file && !item) return setError("Selecciona una foto o un video.");
    if (file && file.size > MAX_SCREENSAVER_MEDIA_BYTES) return setError("El archivo no puede superar los 50 MB.");
    if (file && !file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return setError("El archivo debe ser una imagen o un video.");
    }

    setSaving(true);
    setError(null);
    try {
      const previousUrl = item?.url ?? null;
      let url = item?.url ?? "";
      let type: "image" | "video" = item?.type ?? "image";
      if (file) {
        type = file.type.startsWith("video/") ? "video" : "image";
        setUploadProgress(0);
        url = await uploadScreensaverMedia(eventSlug, type, file, setUploadProgress).promise;
      }
      await onSave({ type, url, order });
      if (file && previousUrl && previousUrl !== url) {
        // El elemento ya quedó guardado con el archivo nuevo; el anterior es basura en Storage.
        deleteScreensaverMedia(previousUrl).catch((err) => console.error("No se pudo borrar el archivo anterior:", err));
      }
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={item ? "Editar elemento" : "Nuevo elemento"}
      centered
      closeOnClickOutside={!saving}
      withCloseButton={!saving}
    >
      <Stack>
        <Stack gap={4}>
          <FileInput
            label="Foto o video"
            description={item ? "Deja vacío para conservar el archivo actual. Máx. 50 MB." : "Máx. 50 MB."}
            placeholder="Seleccionar archivo..."
            accept="image/*,video/*"
            leftSection={<IconPhoto size={16} />}
            value={file}
            onChange={setFile}
            clearable
            disabled={saving}
          />
          {item?.url &&
            !file &&
            (item.type === "image" ? (
              <Image src={item.url} h={80} w="auto" fit="contain" radius="sm" />
            ) : (
              <Anchor href={item.url} target="_blank" rel="noreferrer" size="sm">
                Ver video actual
              </Anchor>
            ))}
          {uploadProgress !== null && <Progress value={uploadProgress} animated />}
        </Stack>
        <NumberInput
          label="Orden"
          description="Los elementos se muestran de menor a mayor."
          value={order}
          onChange={(v) => setOrder(typeof v === "number" ? v : Number(v) || 0)}
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

export default function AdminScreensaver() {
  const { eventSlug, event, screensaverItems } = useAdminEvent();
  const [editing, setEditing] = useState<ScreensaverItem | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ScreensaverItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // AdminEventLayout ya bloquea el render de este Outlet hasta que el evento exista.
  if (!event) return null;

  const nextOrder = screensaverItems.reduce((max, i) => Math.max(max, i.order), 0) + 1;

  const handleSave = async (input: ScreensaverItemInput) => {
    if (editing === "new") await createScreensaverItem(eventSlug, input);
    else if (editing) await updateScreensaverItem(eventSlug, editing.id, input);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteScreensaverItem(eventSlug, toDelete.id);
      deleteScreensaverMedia(toDelete.url).catch((err) => console.error("No se pudo borrar el archivo:", err));
      setToDelete(null);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="md">
      <ScreensaverSettings eventSlug={eventSlug} event={event} />

      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          Fotos y videos que se muestran en rotación cuando se activa el protector de pantalla.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
          Nuevo elemento
        </Button>
      </Group>

      {screensaverItems.length === 0 ? (
        <Text c="dimmed">Este evento aún no tiene fotos ni videos para el protector de pantalla.</Text>
      ) : (
        <Table.ScrollContainer minWidth={500}>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Orden</Table.Th>
                <Table.Th>Vista previa</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {screensaverItems.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{item.order}</Table.Td>
                  <Table.Td>
                    {item.type === "image" ? (
                      <Image src={item.url} h={50} w={80} fit="cover" radius="sm" />
                    ) : (
                      <ThemeIcon variant="light" size={50} radius="sm">
                        <IconVideo size={24} />
                      </ThemeIcon>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={item.type === "image" ? "blue" : "grape"}>
                      {item.type === "image" ? "Foto" : "Video"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(item)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Eliminar"
                          onClick={() => {
                            setDeleteError(null);
                            setToDelete(item);
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {editing && (
        <ScreensaverItemFormModal
          item={editing === "new" ? null : editing}
          nextOrder={nextOrder}
          eventSlug={eventSlug}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        opened={toDelete !== null}
        title="Eliminar elemento"
        message={`Se eliminará este ${toDelete?.type === "video" ? "video" : "elemento"} del protector de pantalla.`}
        confirmLabel="Eliminar"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </Stack>
  );
}
