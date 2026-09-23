import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Button,
  FileInput,
  Group,
  Modal,
  Pagination,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconFileTypePdf, IconPencil, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import ConfirmModal from "../../components/admin/ConfirmModal";
import { usePagination } from "../../components/admin/usePagination";
import { useAdminEvent } from "../../context/useAdminEvent";
import { errorMessage } from "../../services/firestore/batch";
import {
  createPaper,
  deletePaper,
  Paper,
  PaperInput,
  parseAuthors,
  updatePaper,
} from "../../services/firestore/paperService";
import { deletePaperPdf, MAX_PAPER_FILE_BYTES, uploadPaperPdf } from "../../services/storageService";
import { normalizeText } from "../../utils/text";

function PaperFormModal({
  paper,
  onClose,
  onSave,
}: {
  paper: Paper | null;
  onClose: () => void;
  onSave: (input: PaperInput) => Promise<void>;
}) {
  const { eventSlug, categories, papers } = useAdminEvent();
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [institution, setInstitution] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const themes = useMemo(
    () => Array.from(new Set(papers.map((p) => p.theme).filter((t): t is string => !!t))),
    [papers]
  );

  useEffect(() => {
    setTitle(paper?.title ?? "");
    setAuthors(paper?.authors.join("\n") ?? "");
    setInstitution(paper?.institution ?? "");
    setFile(null);
    setCategoryId(paper?.categoryId ?? null);
    setTheme(paper?.theme ?? "");
    setError(null);
    setUploadProgress(null);
  }, [paper]);

  const handleSubmit = async () => {
    if (!title.trim()) return setError("El título es obligatorio.");
    if (!file && !paper?.urlPdf) return setError("Selecciona el archivo PDF del paper.");
    if (file && file.type !== "application/pdf") return setError("El archivo debe ser un PDF.");
    if (file && file.size > MAX_PAPER_FILE_BYTES) return setError("El archivo no puede superar los 30 MB.");

    setSaving(true);
    setError(null);
    try {
      const previousUrl = paper?.urlPdf ?? null;
      let urlPdf = previousUrl ?? "";
      if (file) {
        setUploadProgress(0);
        urlPdf = await uploadPaperPdf(eventSlug, file, setUploadProgress).promise;
      }
      await onSave({
        title: title.trim(),
        authors: parseAuthors(authors),
        institution: institution.trim(),
        urlPdf,
        categoryId,
        theme: theme.trim() || null,
      });
      if (file && previousUrl && previousUrl !== urlPdf) {
        // El paper ya quedó guardado con el archivo nuevo; el anterior es basura en Storage.
        deletePaperPdf(previousUrl).catch((err) => console.error("No se pudo borrar el PDF anterior:", err));
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
      title={paper ? "Editar paper" : "Nuevo paper"}
      size="lg"
      centered
      closeOnClickOutside={!saving}
      withCloseButton={!saving}
    >
      <Stack>
        <TextInput label="Título" value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
        <Textarea
          label="Autores"
          description="Uno por línea (o separados por punto y coma)."
          autosize
          minRows={2}
          value={authors}
          onChange={(e) => setAuthors(e.currentTarget.value)}
        />
        <TextInput label="Institución" value={institution} onChange={(e) => setInstitution(e.currentTarget.value)} />
        <Stack gap={4}>
          <FileInput
            label="Archivo PDF"
            description={
              paper?.urlPdf
                ? "Deja vacío para conservar el archivo actual."
                : "Se sube directo a Firebase Storage (máx. 30 MB)."
            }
            placeholder="Seleccionar PDF..."
            accept="application/pdf"
            leftSection={<IconFileTypePdf size={16} />}
            value={file}
            onChange={setFile}
            clearable
            disabled={saving}
          />
          {paper?.urlPdf && (
            <Anchor href={paper.urlPdf} target="_blank" rel="noreferrer" size="sm">
              Ver archivo actual
            </Anchor>
          )}
          {uploadProgress !== null && <Progress value={uploadProgress} animated />}
        </Stack>
        <Select
          label="Categoría"
          data={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
          clearable
          placeholder="Sin categoría"
        />
        <Autocomplete
          label="Tema"
          description="Texto libre; aparece en el filtro de temas del sitio público."
          data={themes}
          value={theme}
          onChange={setTheme}
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

export default function AdminPapers() {
  const { eventSlug, categories, papers } = useAdminEvent();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Paper | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Paper | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return papers;
    return papers.filter(
      (p) =>
        normalizeText(p.title).includes(term) ||
        normalizeText(p.institution).includes(term) ||
        p.authors.some((a) => normalizeText(a).includes(term))
    );
  }, [papers, search]);
  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const handleSave = async (input: PaperInput) => {
    if (editing === "new") await createPaper(eventSlug, input);
    else if (editing) await updatePaper(eventSlug, editing.id, input);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePaper(eventSlug, toDelete.id);
      setToDelete(null);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <TextInput
          placeholder="Buscar por título, autor o institución"
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
            to={`/admin/${eventSlug}/papers/bulk-upload`}
            variant="light"
            leftSection={<IconUpload size={16} />}
          >
            Carga masiva
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
            Nuevo paper
          </Button>
        </Group>
      </Group>

      <Text size="sm" c="dimmed">
        {filtered.length} de {papers.length} papers
      </Text>

      {papers.length === 0 ? (
        <Text c="dimmed">Este evento aún no tiene papers. Créalos uno a uno o con la carga masiva.</Text>
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Título</Table.Th>
                <Table.Th>Autores</Table.Th>
                <Table.Th>Categoría</Table.Th>
                <Table.Th>Tema</Table.Th>
                <Table.Th>Votos</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pageItems.map((paper) => (
                <Table.Tr key={paper.id}>
                  <Table.Td>{paper.title}</Table.Td>
                  <Table.Td>{paper.authors.join("; ")}</Table.Td>
                  <Table.Td>{categoryName(paper.categoryId)}</Table.Td>
                  <Table.Td>{paper.theme ?? "—"}</Table.Td>
                  <Table.Td>{paper.voteCount}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(paper)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip
                        label={
                          paper.voteCount > 0
                            ? "Tiene votos: reinicia los votos del evento antes de eliminarlo"
                            : "Eliminar"
                        }
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Eliminar"
                          disabled={paper.voteCount > 0}
                          onClick={() => {
                            setDeleteError(null);
                            setToDelete(paper);
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

      {totalPages > 1 && <Pagination value={page} onChange={setPage} total={totalPages} />}

      {editing && (
        <PaperFormModal
          paper={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        opened={toDelete !== null}
        title="Eliminar paper"
        message={`Se eliminará "${toDelete?.title}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </Stack>
  );
}
