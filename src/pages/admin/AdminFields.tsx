import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
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
  createField,
  deleteFieldAndValues,
  FIELD_TYPE_LABELS,
  FieldInput,
  FieldType,
  FILTER_STYLE_LABELS,
  FilterStyle,
  hasValue,
  isListField,
  PaperField,
  updateField,
} from "../../services/firestore/fieldService";

function FieldFormModal({
  field,
  nextOrder,
  onClose,
  onSave,
}: {
  field: PaperField | null;
  nextOrder: number;
  onClose: () => void;
  onSave: (input: FieldInput) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [order, setOrder] = useState<number>(nextOrder);
  const [required, setRequired] = useState(false);
  const [filter, setFilter] = useState<FilterStyle>("none");
  const [revealAfterPrevious, setRevealAfterPrevious] = useState(false);
  const [showOnCard, setShowOnCard] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(field?.label ?? "");
    setType(field?.type ?? "text");
    setOrder(field?.order ?? nextOrder);
    setRequired(field?.required ?? false);
    setFilter(field?.filter ?? "none");
    setRevealAfterPrevious(field?.revealAfterPrevious ?? false);
    setShowOnCard(field?.showOnCard ?? true);
    setError(null);
  }, [field, nextOrder]);

  const list = isListField({ type });

  const handleSubmit = async () => {
    if (!label.trim()) return setError("El nombre es obligatorio.");
    setSaving(true);
    setError(null);
    try {
      await onSave({
        label: label.trim(),
        type,
        order,
        required,
        filter: list ? filter : "none",
        revealAfterPrevious: list && filter !== "none" ? revealAfterPrevious : false,
        showOnCard,
      });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title={field ? "Editar campo" : "Nuevo campo"} centered>
      <Stack>
        <TextInput
          label="Nombre"
          description="Así se llama en el formulario, en la tabla y en el sitio público (ej. Especialización)."
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          data-autofocus
        />
        <Select
          label="Tipo"
          description={
            field
              ? "El tipo no se puede cambiar: los valores ya guardados dejarían de tener sentido. Si lo necesitas, crea otro campo."
              : "Los campos de lista tienen su propia pestaña para administrar las opciones."
          }
          data={Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          value={type}
          onChange={(v) => v && setType(v as FieldType)}
          allowDeselect={false}
          disabled={!!field}
        />
        <NumberInput
          label="Orden"
          description="Orden en el formulario, la tabla, la tarjeta del póster y los filtros (de menor a mayor)."
          value={order}
          onChange={(v) => setOrder(typeof v === "number" ? v : Number(v) || 0)}
        />
        <Checkbox
          label="Obligatorio"
          description="No se puede guardar un paper sin este campo (también en la carga masiva)."
          checked={required}
          onChange={(e) => setRequired(e.currentTarget.checked)}
        />
        <Checkbox
          label="Mostrar en la tarjeta del póster"
          description="En el sitio público, en la tarjeta de la lista y en el detalle del póster."
          checked={showOnCard}
          onChange={(e) => setShowOnCard(e.currentTarget.checked)}
        />
        {list && (
          <Select
            label="Filtro en el sitio público"
            description="Las tarjetas de colores usan el color de cada opción; el primer filtro de tarjetas también colorea el borde de cada póster."
            data={Object.entries(FILTER_STYLE_LABELS).map(([value, label]) => ({ value, label }))}
            value={filter}
            onChange={(v) => v && setFilter(v as FilterStyle)}
            allowDeselect={false}
          />
        )}
        {list && filter !== "none" && (
          <Checkbox
            label="Mostrar solo después de elegir en el filtro anterior"
            description="Ej. el tipo de estudio aparece cuando el visitante elige una especialización. Si el evento pide elegir antes de listar, desactívalo para que se pueda filtrar solo por este campo."
            checked={revealAfterPrevious}
            onChange={(e) => setRevealAfterPrevious(e.currentTarget.checked)}
          />
        )}
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

export default function AdminFields() {
  const { eventSlug, fields, papers } = useAdminEvent();
  const [editing, setEditing] = useState<PaperField | "new" | null>(null);
  const [toDelete, setToDelete] = useState<PaperField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const papersWith = (fieldId: string) => papers.filter((p) => hasValue(p.attributes[fieldId]));
  const nextOrder = fields.reduce((max, f) => Math.max(max, f.order), 0) + 1;

  const handleSave = async (input: FieldInput) => {
    if (editing === "new") await createField(eventSlug, input);
    else if (editing) await updateField(eventSlug, editing.id, input);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFieldAndValues(
        eventSlug,
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
        <Text c="dimmed" size="sm" maw={640}>
          Los atributos de los papers de este evento, además de título, autores, institución, PDF y video (que son
          fijos). Cada campo de lista tiene su propia pestaña para administrar sus opciones.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
          Nuevo campo
        </Button>
      </Group>

      {fields.length === 0 ? (
        <Text c="dimmed">Este evento aún no tiene campos adicionales.</Text>
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Orden</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Filtro público</Table.Th>
                <Table.Th>En tarjeta</Table.Th>
                <Table.Th>Papers con valor</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field) => (
                <Table.Tr key={field.id}>
                  <Table.Td>{field.order}</Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      {isListField(field) ? (
                        <Anchor component={Link} to={`/admin/${eventSlug}/fields/${field.id}`}>
                          {field.label}
                        </Anchor>
                      ) : (
                        field.label
                      )}
                      {field.required && (
                        <Badge size="xs" variant="light" color="red">
                          Obligatorio
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {FIELD_TYPE_LABELS[field.type]}
                    {isListField(field) && (
                      <Text span size="xs" c="dimmed">
                        {" "}
                        ({field.options.length} opciones)
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {field.filter === "none" ? "—" : FILTER_STYLE_LABELS[field.filter]}
                    {field.revealAfterPrevious && (
                      <Text size="xs" c="dimmed">
                        Aparece tras elegir en el anterior
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{field.showOnCard ? "Sí" : "No"}</Table.Td>
                  <Table.Td>
                    {papersWith(field.id).length} de {papers.length}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(field)}>
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
                            setToDelete(field);
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
        <FieldFormModal
          field={editing === "new" ? null : editing}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        opened={toDelete !== null}
        title="Eliminar campo"
        message={
          affected > 0
            ? `Se eliminará "${toDelete?.label}" y su valor en ${affected} paper(s). Esta acción no se puede deshacer.`
            : `Se eliminará "${toDelete?.label}".`
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
