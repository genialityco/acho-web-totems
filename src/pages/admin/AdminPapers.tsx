import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  FileInput,
  Group,
  Modal,
  NumberInput,
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
import {
  IconFileTypePdf,
  IconGitMerge,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconVideo,
} from "@tabler/icons-react";
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

function PaperFormModal({
  paper,
  onClose,
  onSave,
}: {
  paper: Paper | null;
  onClose: () => void;
  onSave: (input: PaperInput) => Promise<void>;
}) {
  const { eventSlug, event, categories, papers } = useAdminEvent();
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [institution, setInstitution] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [studyType, setStudyType] = useState<string | null>(null);
  const [year, setYear] = useState<number | "">("");
  const [country, setCountry] = useState("");
  const [identificationCode, setIdentificationCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const themes = useMemo(
    () => Array.from(new Set(papers.map((p) => p.theme).filter((t): t is string => !!t))),
    [papers]
  );

  // Los del evento, más el actual del paper si ya no está en la lista (renombrado o quitado),
  // para que el select no lo muestre vacío ni lo borre sin que el admin lo note.
  const studyTypeOptions = useMemo(() => {
    const options = event?.studyTypes ?? [];
    return paper?.studyType && !options.includes(paper.studyType) ? [...options, paper.studyType] : options;
  }, [event, paper]);

  useEffect(() => {
    setTitle(paper?.title ?? "");
    setAuthors(paper?.authors.join("\n") ?? "");
    setInstitution(paper?.institution ?? "");
    setFile(null);
    setVideoFile(null);
    setRemoveVideo(false);
    setCategoryId(paper?.categoryId ?? null);
    setTheme(paper?.theme ?? "");
    setStudyType(paper?.studyType ?? null);
    setYear(paper?.year ?? "");
    setCountry(paper?.country ?? "");
    setIdentificationCode(paper?.identificationCode ?? "");
    setError(null);
    setUploadProgress(null);
    setVideoUploadProgress(null);
  }, [paper]);

  const handleSubmit = async () => {
    if (!title.trim()) return setError("El título es obligatorio.");
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
        categoryId,
        theme: theme.trim() || null,
        studyType,
        year: year === "" ? null : year,
        country: country.trim() || null,
        identificationCode: identificationCode.trim() || null,
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
        <Select
          label="Categoría"
          data={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
          clearable
          placeholder="Sin categoría"
        />
        {studyTypeOptions.length > 0 && (
          <Select
            label="Tipo de estudio"
            description="Opcional. La lista se edita en «Editar evento»."
            data={studyTypeOptions}
            value={studyType}
            onChange={setStudyType}
            clearable
            placeholder="Sin tipo de estudio"
          />
        )}
        <Autocomplete
          label="Tema"
          description="Texto libre; aparece en el filtro de temas del sitio público."
          data={themes}
          value={theme}
          onChange={setTheme}
        />
        <Group grow>
          <NumberInput
            label="Año"
            placeholder="Ej. 2026"
            value={year}
            onChange={(v) => setYear(typeof v === "number" ? v : "")}
            min={1900}
            max={2100}
            hideControls
          />
          <TextInput label="País" value={country} onChange={(e) => setCountry(e.currentTarget.value)} />
          <TextInput
            label="Código de identificación"
            value={identificationCode}
            onChange={(e) => setIdentificationCode(e.currentTarget.value)}
          />
        </Group>
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
  const { eventSlug, categories, papers, paperSearchIndex } = useAdminEvent();
  const [search, setSearch] = useState("");
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

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

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
                <Table.Th>Tipo de estudio</Table.Th>
                <Table.Th>Tema</Table.Th>
                <Table.Th>Votos</Table.Th>
                <Table.Th>Vistas</Table.Th>
                <Table.Th>Descargas</Table.Th>
                <Table.Th>Búsqueda</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pageItems.map((paper) => (
                <Table.Tr key={paper.id}>
                  <Table.Td>{paper.title}</Table.Td>
                  <Table.Td>{paper.authors.join("; ")}</Table.Td>
                  <Table.Td>{categoryName(paper.categoryId)}</Table.Td>
                  <Table.Td>{paper.studyType ?? "—"}</Table.Td>
                  <Table.Td>{paper.theme ?? "—"}</Table.Td>
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
