import { useEffect, useState } from "react";
import { Button, Group, Modal, MultiSelect, NumberInput, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { AdvancedSearch, EMPTY_ADVANCED_SEARCH, usePosters } from "../context/usePosters";
import { isListField } from "../services/firestore/fieldService";

// Búsqueda avanzada: título, autores y texto del PDF fijos, más un control por cada campo del evento
// (lista = las mismas opciones que los filtros, número = rango, texto = "contiene"). Los cambios se
// aplican al presionar "Buscar"; "Limpiar" vacía el formulario sin cerrarlo.
export function AdvancedSearchModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { event, fields, advancedSearch, setAdvancedSearch, selectedOptions, setFieldSelection } = usePosters();
  // Estilo "glass" del evento: el modal y las listas desplegables se dibujan dentro del contenedor del sitio
  // público (.gpGlass, ver PublicGlass.css) y no al final de <body>, para heredar el modo oscuro y sus estilos.
  const glass = event?.publicStyle !== "classic";
  const portalProps = glass ? { target: ".gpGlass" } : undefined;
  const [draft, setDraft] = useState<AdvancedSearch>(advancedSearch);
  const [draftOptions, setDraftOptions] = useState<Record<string, string[]>>(selectedOptions);

  // Cada vez que se abre, parte de lo que está aplicado (pudo cambiar con los botones de filtro).
  useEffect(() => {
    if (!opened) return;
    setDraft(advancedSearch);
    setDraftOptions(selectedOptions);
  }, [opened, advancedSearch, selectedOptions]);

  const listFields = fields.filter(isListField);
  const numberFields = fields.filter((f) => f.type === "number");
  const textFields = fields.filter((f) => f.type === "text");

  const apply = () => {
    setAdvancedSearch(draft);
    listFields.forEach((field) => setFieldSelection(field.id, draftOptions[field.id] ?? []));
    onClose();
  };

  const clear = () => {
    setDraft(EMPTY_ADVANCED_SEARCH);
    setDraftOptions({});
  };

  const setRange = (fieldId: string, bound: "min" | "max", value: string | number) => {
    const current = draft.ranges[fieldId] ?? { min: null, max: null };
    setDraft({
      ...draft,
      ranges: { ...draft.ranges, [fieldId]: { ...current, [bound]: typeof value === "number" ? value : null } },
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("posterList.advancedSearch.title")}
      size="lg"
      centered
      portalProps={portalProps}
      className={glass ? "gpGlassModal" : undefined}
      overlayProps={glass ? { backgroundOpacity: 0.4, blur: 2 } : undefined}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            {t("posterList.advancedSearch.hint")}
          </Text>
          <TextInput
            label={t("posterList.advancedSearch.titleLabel")}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
            data-autofocus
          />
          <TextInput
            label={t("posterList.advancedSearch.authorsLabel")}
            value={draft.authors}
            onChange={(e) => setDraft({ ...draft, authors: e.currentTarget.value })}
          />
          {listFields.map((field) => (
            <MultiSelect
              key={field.id}
              label={field.label}
              placeholder={(draftOptions[field.id] ?? []).length ? undefined : t("posterList.advancedSearch.any")}
              data={field.options.map((o) => ({ value: o.id, label: o.name }))}
              value={draftOptions[field.id] ?? []}
              onChange={(value) => setDraftOptions({ ...draftOptions, [field.id]: value })}
              clearable
              searchable
              comboboxProps={{ portalProps }}
            />
          ))}
          {numberFields.map((field) => (
            <SimpleGrid key={field.id} cols={2}>
              <NumberInput
                label={`${field.label} · ${t("posterList.advancedSearch.from")}`}
                value={draft.ranges[field.id]?.min ?? ""}
                onChange={(v) => setRange(field.id, "min", v)}
                hideControls
              />
              <NumberInput
                label={`${field.label} · ${t("posterList.advancedSearch.to")}`}
                value={draft.ranges[field.id]?.max ?? ""}
                onChange={(v) => setRange(field.id, "max", v)}
                hideControls
              />
            </SimpleGrid>
          ))}
          {textFields.map((field) => (
            <TextInput
              key={field.id}
              label={field.label}
              value={draft.text[field.id] ?? ""}
              onChange={(e) => setDraft({ ...draft, text: { ...draft.text, [field.id]: e.currentTarget.value } })}
            />
          ))}
          <TextInput
            label={t("posterList.advancedSearch.bodyLabel")}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.currentTarget.value })}
          />
          <Group justify="space-between">
            <Button variant="subtle" color={glass ? "gray" : undefined} onClick={clear}>
              {t("posterList.advancedSearch.clear")}
            </Button>
            <Button
              type="submit"
              // En "glass", borde luminoso como los botones "Ver póster" de las tarjetas.
              variant={glass ? "default" : "filled"}
              styles={
                glass
                  ? {
                      root: {
                        backgroundColor: "color-mix(in srgb, var(--mantine-color-cyan-6) 14%, transparent)",
                        border: "2px solid var(--mantine-color-cyan-5)",
                        color: "#f1f3f5",
                        boxShadow: "0 0 16px color-mix(in srgb, var(--mantine-color-cyan-5) 50%, transparent)",
                      },
                    }
                  : undefined
              }
            >
              {t("posterList.advancedSearch.apply")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
