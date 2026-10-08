import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  FileInput,
  Group,
  Modal,
  MultiSelect,
  Pagination,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconFileTypePdf,
  IconGitMerge,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSelector,
  IconTrash,
  IconUpload,
  IconVideo,
} from "@tabler/icons-react";
import { AttributeInput } from "../../components/admin/AttributeInput";
import ConfirmModal from "../../components/admin/ConfirmModal";
import { usePagination } from "../../components/admin/usePagination";
import { useAdminEvent } from "../../context/useAdminEvent";
import { errorMessage } from "../../services/firestore/batch";
import {
  createPaper,
  deletePaper,
  mergeDuplicatePaper,
  Paper,
  PaperInput,
  parseAuthors,
  updatePaper,
} from "../../services/firestore/paperService";
import {
  AttributeValue,
  compareAttributes,
  formatAttribute,
  hasValue,
  isListField,
  optionIdsOf,
  PaperAttributes,
} from "../../services/firestore/fieldService";
import { PaperSearchIndex, PaperSearchIndexStatus } from "../../services/firestore/paperSearchIndexService";
import { reindexPaperSearch } from "../../services/firestore/searchQueryService";
import {
  deletePaperPdf,
  deletePaperVideo,
  MAX_PAPER_FILE_BYTES,
  MAX_PAPER_VIDEO_BYTES,
  uploadPaperPdf,
  uploadPaperVideo,
} from "../../services/storageService";
import { normalizeText } from "../../utils/text";

const SEARCH_INDEX_BADGE: Record<PaperSearchIndexStatus, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "gray" },
  processing: { label: "Procesando", color: "blue" },
  ready: { label: "Lista", color: "green" },
  error: { label: "Error", color: "red" },
  unsupported: { label: "No compatible", color: "yellow" },
};

function SearchIndexBadge({
  index,
  onRetry,
  retrying,
}: {
  index: PaperSearchIndex | undefined;
  onRetry: () => void;
  retrying: boolean;
}) {
  const status = index?.status ?? "pending";
  const { label, color } = SEARCH_INDEX_BADGE[status];
  const badge = (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
  return (
    <Group gap={4} wrap="nowrap">
      {index?.error ? <Tooltip label={index.error}>{badge}</Tooltip> : badge}
      {(status === "error" || status === "unsupported") && (
        <Tooltip label="Reintentar indexado">
          <ActionIcon variant="subtle" size="sm" loading={retrying} onClick={onRetry} aria-label="Reintentar indexado">
            <IconRefresh size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

// Columnas ordenables: fijas o un campo del evento (`field:<id>`).
type SortKey = "title" | "votes" | "views" | "downloads" | `field:${string}`;

// Opción especial de los filtros de la tabla: papers sin valor en ese campo.
const NO_VALUE = "__none__";

function PaperFormModal({
  paper,
  onClose,
  onSave,
}: {
  paper: Paper | null;
  onClose: () => void;
  onSave: (input: PaperInput) => Promise<void>;
}) {
  const { eventSlug, fields } = useAdminEvent();
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [institution, setInstitution] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [attributes, setAttributes] = useState<PaperAttributes>({});
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(paper?.title ?? "");
    setAuthors(paper?.authors.join("\n") ?? "");
    setInstitution(paper?.institution ?? "");
    setFile(null);
    setVideoFile(null);
    setRemoveVideo(false);
    setAttributes(paper?.attributes ?? {});
    setError(null);
    setUploadProgress(null);
    setVideoUploadProgress(null);
  }, [paper]);

  const setAttribute = (fieldId: string, value: AttributeValue | undefined) =>
    setAttributes((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[fieldId];
      else next[fieldId] = value;
      return next;
    });

  const handleSubmit = async () => {
    if (!title.trim()) return setError("El título es obligatorio.");
    // Solo valores de campos que siguen existiendo, con el texto recortado.
    const cleanAttributes: PaperAttributes = {};
    fields.forEach((field) => {
      const value = attributes[field.id];
      const clean = typeof value === "string" ? value.trim() : value;
      if (hasValue(clean)) cleanAttributes[field.id] = clean as AttributeValue;
    });
    const missing = fields.find((f) => f.required && !hasValue(cleanAttributes[f.id]));
    if (missing) return setError(`«${missing.label}» es obligatorio.`);
    const willHavePdf = !!file || !!paper?.urlPdf;
    const willHaveVideo = !!videoFile || (!!paper?.urlVideo && !removeVideo);
    if (!willHavePdf && !willHaveVideo) return setError("Selecciona un archivo PDF o un video.");
    if (file && file.type !== "application/pdf") return setError("El archivo debe ser un PDF.");
    if (file && file.size > MAX_PAPER_FILE_BYTES) return setError("El archivo no puede superar los 30 MB.");
    if (videoFile && !videoFile.type.startsWith("video/")) return setError("El video debe ser un archivo de video.");
    if (videoFile && videoFile.size > MAX_PAPER_VIDEO_BYTES) return setError("El video no puede superar los 150 MB.");

    setSaving(true);
    setError(null);
    try {
      const previousUrl = paper?.urlPdf ?? null;
      let urlPdf = previousUrl ?? "";
      if (file) {
        setUploadProgress(0);
        urlPdf = await uploadPaperPdf(eventSlug, file, setUploadProgress).promise;
      }
      const previousVideoUrl = paper?.urlVideo ?? null;
      let urlVideo = previousVideoUrl;
      if (videoFile) {
        setVideoUploadProgress(0);
        urlVideo = await uploadPaperVideo(eventSlug, videoFile, setVideoUploadProgress).promise;
      } else if (removeVideo) {
        urlVideo = null;
      }
      await onSave({
        title: title.trim(),
        authors: parseAuthors(authors),
        institution: institution.trim(),
        urlPdf,
        urlVideo,
        attributes: cleanAttributes,
      });
      if (file && previousUrl && previousUrl !== urlPdf) {
        // El paper ya quedó guardado con el archivo nuevo; el anterior es basura en Storage.
        deletePaperPdf(previousUrl).catch((err) => console.error("No se pudo borrar el PDF anterior:", err));
      }
      if (previousVideoUrl && previousVideoUrl !== urlVideo) {
        deletePaperVideo(previousVideoUrl).catch((err) => console.error("No se pudo borrar el video anterior:", err));
      }
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      setUploadProgress(null);
      setVideoUploadProgress(null);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={paper ? "Editar paper" : "Nuevo paper"}
      size="lg"
      centered
      closeOnClickOutside={false}
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
                : "Opcional si subes un video. Se sube directo a Firebase Storage (máx. 30 MB)."
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
        <Stack gap={4}>
          <FileInput
            label="Video"
            description={
              paper?.urlVideo && !removeVideo
                ? "Deja vacío para conservar el video actual."
                : "Si lo subes, se muestra como contenido principal del póster (en vez del PDF). El PDF, si también hay uno, queda disponible para descargar. No participa en la búsqueda conceptual. Máx. 150 MB."
            }
            placeholder="Seleccionar video..."
            accept="video/*"
            leftSection={<IconVideo size={16} />}
            value={videoFile}
            onChange={(f) => {
              setVideoFile(f);
              if (f) setRemoveVideo(false);
            }}
            clearable
            disabled={saving}
          />
          {paper?.urlVideo && !removeVideo && !videoFile && (
            <Group gap="xs">
              <Anchor href={paper.urlVideo} target="_blank" rel="noreferrer" size="sm">
                Ver video actual
              </Anchor>
              <Tooltip label="Quitar video">
                <ActionIcon variant="subtle" color="red" aria-label="Quitar video" onClick={() => setRemoveVideo(true)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
          {videoUploadProgress !== null && <Progress value={videoUploadProgress} animated />}
        </Stack>
        {fields.length === 0 ? (
          <Text size="sm" c="dimmed">
            Este evento no tiene campos adicionales. Créalos en la pestaña «Campos».
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {fields.map((field) => (
              <AttributeInput
                key={field.id}
                field={field}
                value={attributes[field.id]}
                onChange={(value) => setAttribute(field.id, value)}
              />
            ))}
          </SimpleGrid>
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

export default function AdminPapers() {
  const { eventSlug, fields, papers, paperSearchIndex } = useAdminEvent();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "title", direction: 1 });
  // Por campo de lista: ids de opciones elegidas (NO_VALUE = papers sin valor). Vacío = sin filtro.
  const [fieldFilters, setFieldFilters] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<Paper | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Paper | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retryingPaperId, setRetryingPaperId] = useState<string | null>(null);
  const [reindexingAll, setReindexingAll] = useState(false);
  const [reindexError, setReindexError] = useState<string | null>(null);
  const [merging, setMerging] = useState<Paper | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const listFields = useMemo(() => fields.filter(isListField), [fields]);

  const searchIndexByPaperId = useMemo(
    () => new Map(paperSearchIndex.map((i) => [i.paperId, i])),
    [paperSearchIndex]
  );

  const handleRetryIndex = async (paperId: string) => {
    setRetryingPaperId(paperId);
    setReindexError(null);
    try {
      await reindexPaperSearch(eventSlug, paperId);
    } catch (e) {
      setReindexError(errorMessage(e));
    } finally {
      setRetryingPaperId(null);
    }
  };

  const handleReindexAll = async () => {
    setReindexingAll(true);
    setReindexError(null);
    try {
      await reindexPaperSearch(eventSlug);
    } catch (e) {
      setReindexError(errorMessage(e));
    } finally {
      setReindexingAll(false);
    }
  };

  const openMerge = (paper: Paper) => {
    setMergeError(null);
    setMergeTargetId(null);
    setMerging(paper);
  };

  const handleMerge = async () => {
    if (!merging || !mergeTargetId) return;
    setMergeSaving(true);
    setMergeError(null);
    try {
      await mergeDuplicatePaper(eventSlug, mergeTargetId, merging.id);
      setMerging(null);
      setMergeTargetId(null);
    } catch (e) {
      setMergeError(errorMessage(e));
    } finally {
      setMergeSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    const matchesSearch = (p: Paper) =>
      !term ||
      normalizeText(p.title).includes(term) ||
      normalizeText(p.institution).includes(term) ||
      p.authors.some((a) => normalizeText(a).includes(term)) ||
      fields.some((f) => normalizeText(formatAttribute(f, p.attributes[f.id])).includes(term));
    const matchesFilters = (p: Paper) =>
      listFields.every((f) => {
        const selected = fieldFilters[f.id] ?? [];
        if (selected.length === 0) return true;
        const ids = optionIdsOf(p.attributes[f.id]);
        return ids.length === 0 ? selected.includes(NO_VALUE) : ids.some((id) => selected.includes(id));
      });

    const result = papers.filter((p) => matchesSearch(p) && matchesFilters(p));
    const { key, direction } = sort;
    const field = key.startsWith("field:") ? fields.find((f) => `field:${f.id}` === key) : undefined;
    const metric = (p: Paper) =>
      key === "votes" ? p.voteCount : key === "views" ? p.viewCount : key === "downloads" ? p.downloadCount : 0;
    // papers ya llega alfabético; sort() es estable, así que el título queda como desempate.
    return result.sort((a, b) => {
      if (field) return compareAttributes(field, a.attributes[field.id], b.attributes[field.id], direction);
      if (key === "title") return a.title.localeCompare(b.title, "es", { sensitivity: "base" }) * direction;
      return (metric(a) - metric(b)) * direction;
    });
  }, [papers, fields, listFields, search, fieldFilters, sort]);
  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, direction: prev.key === key ? (prev.direction === 1 ? -1 : 1) : key === "title" ? 1 : -1 }));

  const sortableHeader = (key: SortKey, label: string) => (
    <Table.Th key={key}>
      <UnstyledButton onClick={() => toggleSort(key)} style={{ fontWeight: 700 }}>
        <Group gap={4} wrap="nowrap">
          {label}
          {sort.key !== key ? (
            <IconSelector size={14} opacity={0.4} />
          ) : sort.direction === 1 ? (
            <IconChevronUp size={14} />
          ) : (
            <IconChevronDown size={14} />
          )}
        </Group>
      </UnstyledButton>
    </Table.Th>
  );

  const activeFilterCount = Object.values(fieldFilters).filter((v) => v.length > 0).length;

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
          placeholder="Buscar por título, autor, institución o campos"
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
          <Tooltip label="Vuelve a extraer el texto y el índice de búsqueda de todos los papers del evento">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={reindexingAll}
              onClick={handleReindexAll}
            >
              Reindexar todo
            </Button>
          </Tooltip>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
            Nuevo paper
          </Button>
        </Group>
      </Group>

      {reindexError && <Alert color="red">{reindexError}</Alert>}

      {listFields.length > 0 && (
        <Group gap="sm" align="flex-end">
          {listFields.map((field) => (
            <MultiSelect
              key={field.id}
              label={field.label}
              placeholder={(fieldFilters[field.id] ?? []).length ? undefined : "Todas"}
              data={[
                ...field.options.map((o) => ({ value: o.id, label: o.name })),
                { value: NO_VALUE, label: "(Sin valor)" },
              ]}
              value={fieldFilters[field.id] ?? []}
              onChange={(value) => {
                setFieldFilters((prev) => ({ ...prev, [field.id]: value }));
                setPage(1);
              }}
              clearable
              searchable
              w={{ base: "100%", sm: 240 }}
            />
          ))}
          {activeFilterCount > 0 && (
            <Button
              variant="subtle"
              onClick={() => {
                setFieldFilters({});
                setPage(1);
              }}
            >
              Quitar filtros
            </Button>
          )}
        </Group>
      )}

      <Text size="sm" c="dimmed">
        {filtered.length} de {papers.length} papers · clic en un encabezado para ordenar
      </Text>

      {papers.length === 0 ? (
        <Text c="dimmed">Este evento aún no tiene papers. Créalos uno a uno o con la carga masiva.</Text>
      ) : (
        <Table.ScrollContainer minWidth={800 + fields.length * 140}>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {sortableHeader("title", "Título")}
                <Table.Th>Autores</Table.Th>
                {fields.map((field) => sortableHeader(`field:${field.id}`, field.label))}
                {sortableHeader("votes", "Votos")}
                {sortableHeader("views", "Vistas")}
                {sortableHeader("downloads", "Descargas")}
                <Table.Th>Búsqueda</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pageItems.map((paper) => (
                <Table.Tr key={paper.id}>
                  <Table.Td>{paper.title}</Table.Td>
                  <Table.Td>{paper.authors.join("; ")}</Table.Td>
                  {fields.map((field) => (
                    <Table.Td key={field.id}>{formatAttribute(field, paper.attributes[field.id]) || "—"}</Table.Td>
                  ))}
                  <Table.Td>{paper.voteCount}</Table.Td>
                  <Table.Td>{paper.viewCount}</Table.Td>
                  <Table.Td>{paper.downloadCount}</Table.Td>
                  <Table.Td>
                    <SearchIndexBadge
                      index={searchIndexByPaperId.get(paper.id)}
                      onRetry={() => handleRetryIndex(paper.id)}
                      retrying={retryingPaperId === paper.id}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => setEditing(paper)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Fusionar con otro paper (duplicado)">
                        <ActionIcon variant="subtle" aria-label="Fusionar" onClick={() => openMerge(paper)}>
                          <IconGitMerge size={16} />
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

      <ConfirmModal
        opened={merging !== null}
        title="Fusionar paper duplicado"
        message={
          `Se sumarán los votos, vistas y descargas de "${merging?.title}" al paper que elijas, ` +
          "sus votos individuales se reasignarán, y este quedará eliminado. Esta acción no se puede deshacer."
        }
        confirmLabel="Fusionar y eliminar"
        confirmDisabled={!mergeTargetId}
        loading={mergeSaving}
        error={mergeError}
        onConfirm={handleMerge}
        onClose={() => setMerging(null)}
      >
        <Select
          mt="md"
          label="Conservar en"
          placeholder="Selecciona el paper que se queda"
          data={papers
            .filter((p) => p.id !== merging?.id)
            .map((p) => ({ value: p.id, label: p.urlVideo ? `${p.title} (con video)` : p.title }))}
          value={mergeTargetId}
          onChange={setMergeTargetId}
          searchable
        />
      </ConfirmModal>
    </Stack>
  );
}
