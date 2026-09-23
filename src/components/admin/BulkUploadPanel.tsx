import { useState } from "react";
import { Alert, Anchor, Badge, Button, Group, Modal, Stack, Table, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconDownload, IconUpload } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { downloadReport, downloadTemplate, RawRow, readSheetRows } from "./bulkUtils";

export type RowStatus = "OK" | "SKIPPED" | "ERROR";

export type PreviewRow<T> = {
  cells: string[];
  status: RowStatus;
  message: string;
  data?: T;
};

type Props<T> = {
  title: string;
  hint: string;
  headers: string[];
  templateFileName: string;
  reportFileName: string;
  backTo: string;
  validate: (rows: RawRow[]) => PreviewRow<T>[];
  // Devuelve, por fila, el mensaje de error si no se pudo guardar (o undefined si se guardó).
  commit: (rows: T[]) => Promise<(string | undefined)[]>;
};

const STATUS_COLOR: Record<RowStatus, string> = { OK: "green", SKIPPED: "yellow", ERROR: "red" };

function RowsTable<T>({ headers, rows }: { headers: string[]; rows: PreviewRow<T>[] }) {
  return (
    <Table.ScrollContainer minWidth={960} mah={420}>
      <Table striped withTableBorder stickyHeader>
        <Table.Thead>
          <Table.Tr>
            {headers.map((h) => (
              <Table.Th key={h}>{h}</Table.Th>
            ))}
            <Table.Th style={{ minWidth: 110 }}>Estado</Table.Th>
            <Table.Th>Mensaje</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, i) => (
            <Table.Tr key={i}>
              {row.cells.map((cell, j) => (
                <Table.Td key={j}>{cell}</Table.Td>
              ))}
              <Table.Td style={{ whiteSpace: "nowrap", minWidth: 110 }}>
                <Badge color={STATUS_COLOR[row.status]}>{row.status}</Badge>
              </Table.Td>
              <Table.Td style={{ minWidth: 240 }}>{row.message}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export default function BulkUploadPanel<T>({
  title,
  hint,
  headers,
  templateFileName,
  reportFileName,
  backTo,
  validate,
  commit,
}: Props<T>) {
  const [preview, setPreview] = useState<PreviewRow<T>[] | null>(null);
  const [result, setResult] = useState<PreviewRow<T>[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const rows = validate(await readSheetRows(file));
      if (rows.length === 0) {
        setError("El archivo no tiene filas para importar.");
        return;
      }
      setPreview(rows);
    } catch (e) {
      console.error(e);
      setError("No se pudo leer el archivo. Verifica que sea un Excel (.xlsx o .xls) válido.");
    }
  };

  const validRows = preview?.filter((row) => row.status === "OK") ?? [];

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const errors = await commit(validRows.map((row) => row.data as T));
      let index = 0;
      setResult(
        preview.map((row) => {
          if (row.status !== "OK") return row;
          const rowError = errors[index++];
          return rowError
            ? { ...row, status: "ERROR" as const, message: `No se guardó: ${rowError}` }
            : row;
        })
      );
      setPreview(null);
    } catch (e) {
      console.error(e);
      setError("Falló la importación. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const count = (status: RowStatus) => result?.filter((row) => row.status === status).length ?? 0;

  return (
    <Stack gap="md">
      <Anchor component={Link} to={backTo} size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} />
          Volver
        </Group>
      </Anchor>
      <Title order={4}>{title}</Title>
      <Text size="sm" c="dimmed">
        {hint}
      </Text>

      <Group>
        <Button
          color="teal"
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={() => downloadTemplate(templateFileName, headers)}
        >
          Descargar plantilla
        </Button>
        <Button component="label" leftSection={<IconUpload size={16} />}>
          Cargar archivo de Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleFile} />
        </Button>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      {result && (
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="sm">
              <Text fw={600}>Resultado de la importación</Text>
              <Badge color="green">{count("OK")} guardadas</Badge>
              <Badge color="yellow">{count("SKIPPED")} omitidas</Badge>
              <Badge color="red">{count("ERROR")} con error</Badge>
            </Group>
            <Button
              variant="outline"
              leftSection={<IconDownload size={16} />}
              onClick={() =>
                downloadReport(
                  reportFileName,
                  [...headers, "estado", "mensaje"],
                  result.map((row) => [...row.cells, row.status, row.message])
                )
              }
            >
              Descargar informe
            </Button>
          </Group>
          <RowsTable headers={headers} rows={result} />
        </Stack>
      )}

      <Modal
        opened={preview !== null}
        onClose={() => !busy && setPreview(null)}
        title="Vista previa de la importación"
        size="90%"
      >
        {preview && (
          <Stack gap="md">
            <Text size="sm">
              {validRows.length === 1 ? "Se importará" : "Se importarán"} <b>{validRows.length}</b> de{" "}
              {preview.length} filas. Las omitidas y con error no se guardan.
            </Text>
            <RowsTable headers={headers} rows={preview} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreview(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={handleImport} loading={busy} disabled={validRows.length === 0}>
                Importar {validRows.length} {validRows.length === 1 ? "fila" : "filas"}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
