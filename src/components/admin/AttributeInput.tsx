import { MultiSelect, NumberInput, Select, TextInput } from "@mantine/core";
import { AttributeValue, optionIdsOf, PaperField } from "../../services/firestore/fieldService";

// Control del formulario de paper para un campo del evento, según su tipo. `undefined` = sin valor.
export function AttributeInput({
  field,
  value,
  onChange,
}: {
  field: PaperField;
  value: AttributeValue | undefined;
  onChange: (value: AttributeValue | undefined) => void;
}) {
  const common = { label: field.label, withAsterisk: field.required };
  const options = field.options.map((o) => ({ value: o.id, label: o.name }));
  const noOptions = options.length === 0 ? "Este campo aún no tiene opciones: créalas en su pestaña." : undefined;

  switch (field.type) {
    case "number":
      return (
        <NumberInput
          {...common}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => onChange(typeof v === "number" ? v : undefined)}
          hideControls
        />
      );
    case "select":
      return (
        <Select
          {...common}
          description={noOptions}
          data={options}
          value={optionIdsOf(value)[0] ?? null}
          onChange={(v) => onChange(v ?? undefined)}
          clearable
          searchable
          placeholder="Sin valor"
        />
      );
    case "multiselect":
      return (
        <MultiSelect
          {...common}
          description={noOptions}
          data={options}
          value={optionIdsOf(value)}
          onChange={(v) => onChange(v.length ? v : undefined)}
          clearable
          searchable
          placeholder={optionIdsOf(value).length ? undefined : "Sin valor"}
        />
      );
    default:
      return (
        <TextInput
          {...common}
          value={typeof value === "string" ? value : value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.currentTarget.value || undefined)}
        />
      );
  }
}
