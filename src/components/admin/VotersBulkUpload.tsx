import { useAdminEvent } from "../../context/useAdminEvent";
import { importVoters, isValidVoterId, VoterInput } from "../../services/firestore/voterService";
import BulkUploadPanel, { PreviewRow } from "./BulkUploadPanel";
import { getCell, RawRow } from "./bulkUtils";

const HEADERS = ["idNumber", "fullName", "active"];

const parseActive = (text: string): boolean | null => {
  const value = text.toLowerCase();
  if (value === "") return true;
  if (["true", "1", "si", "sí", "yes", "activo"].includes(value)) return true;
  if (["false", "0", "no", "inactivo"].includes(value)) return false;
  return null;
};

export default function VotersBulkUpload() {
  const { eventSlug, voters } = useAdminEvent();

  const validate = (rawRows: RawRow[]): PreviewRow<VoterInput>[] => {
    const existingIds = new Set(voters.map((v) => v.id));
    const seenIds = new Set<string>();

    return rawRows.map((raw) => {
      const cells = HEADERS.map((header) => getCell(raw, header));
      const [idNumber, fullName, activeText] = cells;
      const error = (message: string): PreviewRow<VoterInput> => ({ cells, status: "ERROR", message });

      if (!isValidVoterId(idNumber)) return error("idNumber vacío o inválido (no puede contener /)");
      const active = parseActive(activeText);
      if (active === null) return error("active debe ser si/no, true/false, 1/0, activo/inactivo o vacío");
      if (seenIds.has(idNumber)) {
        return { cells, status: "SKIPPED", message: "Cédula repetida en el archivo" };
      }
      seenIds.add(idNumber);

      return {
        cells,
        status: "OK",
        message: existingIds.has(idNumber) ? "Se actualizará" : "Se creará",
        data: { idNumber, fullName, active },
      };
    });
  };

  return (
    <BulkUploadPanel
      title="Carga masiva del padrón de votantes"
      hint="Una fila por votante. La cédula (idNumber) identifica a la persona: si ya existe se actualiza, si no se crea. active acepta si/no, true/false, 1/0 o activo/inactivo; vacío cuenta como activo."
      headers={HEADERS}
      templateFileName="votantes_template.xlsx"
      reportFileName="votantes_informe.xlsx"
      backTo={`/admin/${eventSlug}/voters`}
      validate={validate}
      commit={(rows) => importVoters(eventSlug, rows)}
    />
  );
}
