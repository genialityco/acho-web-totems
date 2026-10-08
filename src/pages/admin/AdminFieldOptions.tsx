import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import ConfirmModal from "../../components/admin/ConfirmModal";
import { useAdminEvent } from "../../context/useAdminEvent";
import { errorMessage } from "../../services/firestore/batch";
import {
  deleteFieldOption,
  FieldOption,
  isListField,
  newOptionId,
  OPTION_COLORS,
  optionIdsOf,
  saveFieldOptions,
} from "../../services/firestore/fieldService";
import { normalizeText } from "../../utils/text";

function OptionFormModal({
  option,
  nextOrder,
  withColor,
  onClose,
  onSave,
}: {
  option: FieldOption | null;
  nextOrder: number;
  withColor: boolean;
  onClose: () => void;
  onSave: (input: Omit<FieldOption, "id">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [order, setOrder] = useState<number>(nextOrder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(option?.name ?? "");
    setColor(option?.color ?? (withColor ? "blue" : null));
    setOrder(option?.order ?? nextOrder);
    setError(null);
  }, [option, nextOrder, withColor]);

  const handleSubmit = async () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), color, order });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title={option ? "Editar opción" : "Nueva opción"} centered>
      <Stack>
        <TextInput label="Nombre" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <Select
          label="Color"
          description={withColor ? undefined : "Solo se usa si este campo es un filtro de tarjetas de colores."}
          data={OPTION_COLORS}
          value={color}
          onChange={setColor}
          clearable
          placeholder="Sin color"
        />
        <NumberInput
          label="Orden"
          description="Las opciones se muestran de menor a mayor."
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

export default function AdminFieldOptions() {
  const { fieldId = "" } = useParams<{ fieldId: string }>();
  const { eventSlug, fields, papers } = useAdminEvent();
  const [editing, setEditing] = useState<FieldOption | "new" | null>(null);
  const [toDelete, setToDelete] = useState<FieldOption | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const field = fields.find((f) => f.id === fieldId);
  if (!field || !isListField(field)) return <Navigate to={`/admin/${eventSlug}/fields`} replace />;

  const papersWith = (optionId: string) =>
    papers.filter((p) => optionIdsOf(p.attributes[field.id]).includes(optionId));
  const withoutValue = papers.filter((p) => optionIdsOf(p.attributes[field.id]).length === 0).length;
  const nextOrder = field.options.reduce((max, o) => Math.max(max, o.order), 0) + 1;

  const handleSave = async (input: Omit<FieldOption, "id">) => {
    const duplicate = field.options.find(
      (o) => normalizeText(o.name) === normalizeText(input.name) && (editing === "new" || o.id !== editing?.id)
    );
    if (duplicate) throw new Error(`Ya existe una opción llamada "${duplicate.name}".`);
    const options =
      editing === "new"
        ? [...field.options, { id: newOptionId(), ...input }]
        : field.options.map((o) => (editing && o.id === editing.id ? { ...o, ...input } : o));
    await saveFieldOptions(eventSlug, field.id, options);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFieldOption(
        eventSlug,
        field,
        toDelete.id,
        papersWith(toDelete.id).map((p) => p.id)
      );
      setToDelete(null);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const affected = toDelete ? papersWith(toDelete.id).length : 0;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          Opciones de «{field.label}». {withoutValue} de {papers.length} papers no tienen ninguna.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
          Nueva opción
        </Button>
      </Group>

      {field.options.length === 0 ? (
        <Text c="dimmed">Este campo aún no tiene opciones.</Text>
      ) : (
        <Table.ScrollContainer minWidth={500}>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Orden</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Color</Table.Th>
                <Table.Th>Papers</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {field.options.map((option) => (
                <Table.Tr key={option.id}>
                  <Table.Td>{option.order}</Table.Td>
                  <Table.Td>{option.name}</Table.Td>
                  <Table.Td>
                    {option.color ? (
                      <Badge color={option.color}>
                        {OPTION_COLORS.find((c) => c.value === option.color)?.label ?? option.color}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Table.Td>
                  <Table.Td>{papersWith(option.id).length}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(option)}>
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
                            setToDelete(option);
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
        <OptionFormModal
          option={editing === "new" ? null : editing}
          nextOrder={nextOrder}
          withColor={field.filter === "cards"}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        opened={toDelete !== null}
        title="Eliminar opción"
        message={
          affected > 0
            ? `Se eliminará "${toDelete?.name}". ${affected} paper(s) la perderán.`
            : `Se eliminará "${toDelete?.name}".`
        }
        confirmLabel="Eliminar"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </Stack>
  );
}
