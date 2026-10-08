import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  Pagination,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import MetricsCharts from "../../components/admin/MetricsCharts";
import ConfirmModal from "../../components/admin/ConfirmModal";
import { usePagination } from "../../components/admin/usePagination";
import { useAdminEvent } from "../../context/useAdminEvent";
import { formatAttribute, isListField } from "../../services/firestore/fieldService";
import { errorMessage } from "../../services/firestore/batch";
import { resetVotes } from "../../services/firestore/voteService";
import { resetPaperMetrics } from "../../services/firestore/paperMetricsService";

const CONFIRM_WORD = "REINICIAR";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Title order={2}>{value}</Title>
    </Card>
  );
}

export default function AdminResults() {
  const { eventSlug, fields, papers, voters, votes } = useAdminEvent();
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [metricsResetOpen, setMetricsResetOpen] = useState(false);
  const [metricsConfirmText, setMetricsConfirmText] = useState("");
  const [resettingMetrics, setResettingMetrics] = useState(false);
  const [metricsResetError, setMetricsResetError] = useState<string | null>(null);
  const [metricsResetResult, setMetricsResetResult] = useState<string | null>(null);

  const ranking = useMemo(
    () =>
      [...papers].sort(
        (a, b) => b.voteCount - a.voteCount || a.title.localeCompare(b.title, "es", { sensitivity: "base" })
      ),
    [papers]
  );
  const rankingPager = usePagination(ranking);

  const auditRows = useMemo(() => {
    const voterName = new Map(voters.map((v) => [v.id, v.fullName]));
    const paperTitle = new Map(papers.map((p) => [p.id, p.title]));
    return [...votes]
      .sort((a, b) => (b.castAt?.getTime() ?? 0) - (a.castAt?.getTime() ?? 0))
      .map((vote) => ({
        key: vote.voterId,
        date: vote.castAt ? vote.castAt.toLocaleString("es-CO") : "—",
        idNumber: vote.voterId,
        name: voterName.get(vote.voterId) || "—",
        paper: paperTitle.get(vote.paperId) ?? "(paper eliminado)",
      }));
  }, [votes, voters, papers]);
  const auditPager = usePagination(auditRows);

  // Campos de lista que se ven en la tarjeta del póster (ej. la especialización), como columnas del ranking.
  const rankingFields = fields.filter((f) => isListField(f) && f.showOnCard);
  const activeVoters = voters.filter((v) => v.active).length;
  const participation = activeVoters > 0 ? Math.round((votes.length / activeVoters) * 100) : 0;
  const totalViews = papers.reduce((sum, p) => sum + p.viewCount, 0);
  const totalDownloads = papers.reduce((sum, p) => sum + p.downloadCount, 0);

  const openReset = () => {
    setConfirmText("");
    setResetError(null);
    setResetOpen(true);
  };

  const handleReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const { votesDeleted, papersReset } = await resetVotes(eventSlug);
      setResetResult(`Se eliminaron ${votesDeleted} votos y se reinició el conteo de ${papersReset} papers.`);
      setResetOpen(false);
    } catch (e) {
      setResetError(errorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  const openMetricsReset = () => {
    setMetricsConfirmText("");
    setMetricsResetError(null);
    setMetricsResetOpen(true);
  };

  const handleResetMetrics = async () => {
    setResettingMetrics(true);
    setMetricsResetError(null);
    try {
      const { papersReset } = await resetPaperMetrics(eventSlug);
      setMetricsResetResult(`Se reiniciaron las vistas y descargas de ${papersReset} papers.`);
      setMetricsResetOpen(false);
    } catch (e) {
      setMetricsResetError(errorMessage(e));
    } finally {
      setResettingMetrics(false);
    }
  };

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <Stat label="Papers" value={papers.length} />
        <Stat label="Votantes activos" value={activeVoters} />
        <Stat label="Votos emitidos" value={votes.length} />
        <Stat label="Participación" value={`${participation}%`} />
        <Stat label="Vistas de pósters" value={totalViews} />
        <Stat label="Descargas de PDF" value={totalDownloads} />
      </SimpleGrid>

      {resetResult && (
        <Alert color="green" withCloseButton onClose={() => setResetResult(null)}>
          {resetResult}
        </Alert>
      )}
      {metricsResetResult && (
        <Alert color="green" withCloseButton onClose={() => setMetricsResetResult(null)}>
          {metricsResetResult}
        </Alert>
      )}

      <MetricsCharts />

      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Ranking de papers</Title>
          <Group gap="xs">
            <Button color="red" variant="outline" leftSection={<IconRefresh size={16} />} onClick={openMetricsReset}>
              Reiniciar vistas y descargas
            </Button>
            <Button color="red" variant="outline" leftSection={<IconRefresh size={16} />} onClick={openReset}>
              Reiniciar votos
            </Button>
          </Group>
        </Group>
        {ranking.length === 0 ? (
          <Text c="dimmed">Este evento aún no tiene papers.</Text>
        ) : (
          <>
            <Table.ScrollContainer minWidth={640}>
              <Table withTableBorder highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Título</Table.Th>
                    {rankingFields.map((field) => (
                      <Table.Th key={field.id}>{field.label}</Table.Th>
                    ))}
                    <Table.Th>Votos</Table.Th>
                    <Table.Th>Vistas</Table.Th>
                    <Table.Th>Descargas</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rankingPager.pageItems.map((paper, i) => (
                    <Table.Tr key={paper.id}>
                      <Table.Td>{(rankingPager.page - 1) * 25 + i + 1}</Table.Td>
                      <Table.Td>{paper.title}</Table.Td>
                      {rankingFields.map((field) => (
                        <Table.Td key={field.id}>{formatAttribute(field, paper.attributes[field.id]) || "—"}</Table.Td>
                      ))}
                      <Table.Td>
                        <b>{paper.voteCount}</b>
                      </Table.Td>
                      <Table.Td>{paper.viewCount}</Table.Td>
                      <Table.Td>{paper.downloadCount}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {rankingPager.totalPages > 1 && (
              <Pagination value={rankingPager.page} onChange={rankingPager.setPage} total={rankingPager.totalPages} />
            )}
          </>
        )}
      </Stack>

      <Stack gap="sm">
        <Title order={5}>Votos emitidos</Title>
        {auditRows.length === 0 ? (
          <Text c="dimmed">Todavía no hay votos.</Text>
        ) : (
          <>
            <Table.ScrollContainer minWidth={640}>
              <Table withTableBorder highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Cédula</Table.Th>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Votó por</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {auditPager.pageItems.map((row) => (
                    <Table.Tr key={row.key}>
                      <Table.Td>{row.date}</Table.Td>
                      <Table.Td>{row.idNumber}</Table.Td>
                      <Table.Td>{row.name}</Table.Td>
                      <Table.Td>{row.paper}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {auditPager.totalPages > 1 && (
              <Pagination value={auditPager.page} onChange={auditPager.setPage} total={auditPager.totalPages} />
            )}
          </>
        )}
      </Stack>

      <ConfirmModal
        opened={resetOpen}
        title="Reiniciar votos"
        message={`Se eliminarán los ${votes.length} votos de este evento y el conteo de todos los papers volverá a 0. Todos los votantes podrán votar de nuevo. Esta acción no se puede deshacer.`}
        confirmLabel="Reiniciar votos"
        confirmDisabled={confirmText !== CONFIRM_WORD}
        loading={resetting}
        error={resetError}
        onConfirm={handleReset}
        onClose={() => setResetOpen(false)}
      >
        <TextInput
          mt="md"
          label={`Escribe ${CONFIRM_WORD} para confirmar`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.currentTarget.value)}
        />
      </ConfirmModal>

      <ConfirmModal
        opened={metricsResetOpen}
        title="Reiniciar vistas y descargas"
        message={`Las vistas (${totalViews}) y descargas (${totalDownloads}) de todos los papers de este evento volverán a 0. No afecta los votos. Esta acción no se puede deshacer.`}
        confirmLabel="Reiniciar vistas y descargas"
        confirmDisabled={metricsConfirmText !== CONFIRM_WORD}
        loading={resettingMetrics}
        error={metricsResetError}
        onConfirm={handleResetMetrics}
        onClose={() => setMetricsResetOpen(false)}
      >
        <TextInput
          mt="md"
          label={`Escribe ${CONFIRM_WORD} para confirmar`}
          value={metricsConfirmText}
          onChange={(e) => setMetricsConfirmText(e.currentTarget.value)}
        />
      </ConfirmModal>
    </Stack>
  );
}
