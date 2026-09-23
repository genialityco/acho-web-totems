import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import ConfirmModal from "../../components/admin/ConfirmModal";
import { usePagination } from "../../components/admin/usePagination";
import { useAdminEvent } from "../../context/useAdminEvent";
import { errorMessage } from "../../services/firestore/batch";
import {
  deleteVoter,
  isValidVoterId,
  saveVoter,
  setVoterActive,
  Voter,
  VoterInput,
} from "../../services/firestore/voterService";
import { normalizeText } from "../../utils/text";

function VoterFormModal({
  voter,
  onClose,
  onSave,
}: {
  voter: Voter | null;
  onClose: () => void;
  onSave: (input: VoterInput) => Promise<void>;
}) {
  const { voters } = useAdminEvent();
  const [idNumber, setIdNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdNumber(voter?.idNumber ?? "");
    setFullName(voter?.fullName ?? "");
    setActive(voter?.active ?? true);
    setError(null);
  }, [voter]);

  const handleSubmit = async () => {
    const id = idNumber.trim();
    if (!isValidVoterId(id)) return setError("La cédula es obligatoria y no puede contener /.");
    if (!voter && voters.some((v) => v.id === id)) return setError("Ya existe un votante con esa cédula.");
    setSaving(true);
    setError(null);
    try {
      await onSave({ idNumber: id, fullName: fullName.trim(), active });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title={voter ? "Editar votante" : "Nuevo votante"} centered>
      <Stack>
        <TextInput
          label="Cédula"
          value={idNumber}
          onChange={(e) => setIdNumber(e.currentTarget.value)}
          disabled={voter !== null}
          data-autofocus
        />
        <TextInput label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.currentTarget.value)} />
        <Switch
          label="Activo (puede votar)"
          checked={active}
          onChange={(e) => setActive(e.currentTarget.checked)}
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

export default function AdminVoters() {
  const { eventSlug, voters, votes } = useAdminEvent();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Voter | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Voter | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const votedIds = useMemo(() => new Set(votes.map((v) => v.voterId)), [votes]);

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return voters;
    return voters.filter((v) => normalizeText(`${v.fullName} ${v.idNumber}`).includes(term));
  }, [voters, search]);
  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const handleSave = async (input: VoterInput) => {
    await saveVoter(eventSlug, input);
    setEditing(null);
  };

  const handleToggle = async (voter: Voter, active: boolean) => {
    setError(null);
    try {
      await setVoterActive(eventSlug, voter.id, active);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteVoter(eventSlug, toDelete.id);
      setToDelete(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <TextInput
          placeholder="Buscar por nombre o cédula"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={{ base: "100%", sm: 360 }}
        />
        <Group>
          <Button
            component={Link}
            to={`/admin/${eventSlug}/voters/bulk-upload`}
            variant="light"
            leftSection={<IconUpload size={16} />}
          >
            Carga masiva
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
            Nuevo votante
          </Button>
        </Group>
      </Group>

      <Text size="sm" c="dimmed">
        Solo las cédulas de este padrón pueden votar. {filtered.length} de {voters.length} votantes.
      </Text>

      {error && <Alert color="red">{error}</Alert>}

      {voters.length === 0 ? (
        <Text c="dimmed">El padrón está vacío. Agrega votantes uno a uno o con la carga masiva.</Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cédula</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Activo</Table.Th>
                <Table.Th>¿Votó?</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pageItems.map((voter) => (
                <Table.Tr key={voter.id}>
                  <Table.Td>{voter.idNumber}</Table.Td>
                  <Table.Td>{voter.fullName}</Table.Td>
                  <Table.Td>
                    <Switch
                      checked={voter.active}
                      onChange={(e) => void handleToggle(voter, e.currentTarget.checked)}
                      aria-label={`Activo: ${voter.fullName || voter.idNumber}`}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Badge color={votedIds.has(voter.id) ? "green" : "gray"}>
                      {votedIds.has(voter.id) ? "Sí" : "No"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(voter)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Eliminar"
                          onClick={() => setToDelete(voter)}
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

      {totalPages > 1 && <Pagination value={page} onChange={setPage} total={totalPages} />}

      {editing && (
        <VoterFormModal
          voter={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        opened={toDelete !== null}
        title="Eliminar votante"
        message={`Se eliminará a "${toDelete?.fullName || toDelete?.idNumber}" del padrón.${
          toDelete && votedIds.has(toDelete.id) ? " Su voto ya emitido se conserva." : ""
        }`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </Stack>
  );
}
