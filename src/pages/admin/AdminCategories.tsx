import { useEffect, useState } from "react";
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
import {
  Category,
  CategoryInput,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../../services/firestore/categoryService";
import { errorMessage } from "../../services/firestore/batch";

const COLORS = [
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "red", label: "Rojo" },
  { value: "purple", label: "Morado" },
  { value: "orange", label: "Naranja" },
  { value: "teal", label: "Turquesa" },
  { value: "pink", label: "Rosado" },
  { value: "indigo", label: "Índigo" },
];

function CategoryFormModal({
  category,
  nextOrder,
  onClose,
  onSave,
}: {
  category: Category | null;
  nextOrder: number;
  onClose: () => void;
  onSave: (input: CategoryInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("blue");
  const [order, setOrder] = useState<number>(nextOrder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(category?.name ?? "");
    setColor(category?.color ?? "blue");
    setOrder(category?.order ?? nextOrder);
    setError(null);
  }, [category, nextOrder]);

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
    <Modal opened onClose={onClose} title={category ? "Editar categoría" : "Nueva categoría"} centered>
      <Stack>
        <TextInput
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <Select label="Color" data={COLORS} value={color} onChange={(v) => v && setColor(v)} allowDeselect={false} />
        <NumberInput
          label="Orden"
          description="Las categorías se muestran de menor a mayor."
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

export default function AdminCategories() {
  const { eventSlug, categories, papers } = useAdminEvent();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const papersIn = (categoryId: string) => papers.filter((p) => p.categoryId === categoryId);
  const nextOrder = categories.reduce((max, c) => Math.max(max, c.order), 0) + 1;

  const handleSave = async (input: CategoryInput) => {
    if (editing === "new") await createCategory(eventSlug, input);
    else if (editing) await updateCategory(eventSlug, editing.id, input);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCategory(
        eventSlug,
        toDelete.id,
        papersIn(toDelete.id).map((p) => p.id)
      );
      setToDelete(null);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const affected = toDelete ? papersIn(toDelete.id).length : 0;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          Son las tarjetas de colores que ven los asistentes para filtrar los papers.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
          Nueva categoría
        </Button>
      </Group>

      {categories.length === 0 ? (
        <Text c="dimmed">Este evento aún no tiene categorías.</Text>
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
              {categories.map((category) => (
                <Table.Tr key={category.id}>
                  <Table.Td>{category.order}</Table.Td>
                  <Table.Td>{category.name}</Table.Td>
                  <Table.Td>
                    <Badge color={category.color}>
                      {COLORS.find((c) => c.value === category.color)?.label ?? category.color}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{papersIn(category.id).length}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(category)}>
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
                            setToDelete(category);
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
        <CategoryFormModal
          category={editing === "new" ? null : editing}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        opened={toDelete !== null}
        title="Eliminar categoría"
        message={
          affected > 0
            ? `Se eliminará "${toDelete?.name}". ${affected} paper(s) quedarán sin categoría.`
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
