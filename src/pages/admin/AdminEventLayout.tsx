import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Center,
  Code,
  ColorInput,
  Divider,
  FileInput,
  Group,
  Image,
  Loader,
  Modal,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink, IconPencil, IconPhoto, IconTrash } from "@tabler/icons-react";
import VotingControl from "../../components/admin/VotingControl";
import { AdminEventProvider } from "../../context/AdminEventContext";
import { useAdminEvent } from "../../context/useAdminEvent";
import {
  DEFAULT_WALL_GAP_CM,
  EventInfo,
  PublicStyle,
  updateEvent,
  VoteMode,
} from "../../services/firestore/eventService";
import { isListField } from "../../services/firestore/fieldService";
import { errorMessage } from "../../services/firestore/batch";
import { deleteEventImage, MAX_EVENT_IMAGE_BYTES, uploadEventImage } from "../../services/storageService";
import { isHttpUrl } from "../../utils/text";
import { WALL_SHAPE_DEFAULT_COLORS, WallShape } from "../../utils/wallShapes";

function EventImageField({
  label,
  description,
  currentUrl,
  file,
  onFileChange,
  removed,
  onRemove,
  progress,
  disabled,
}: {
  label: string;
  description: string;
  currentUrl: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  removed: boolean;
  onRemove: () => void;
  progress: number | null;
  disabled: boolean;
}) {
  return (
    <Stack gap={4}>
      <FileInput
        label={label}
        description={description}
        placeholder="Seleccionar imagen..."
        accept="image/*"
        leftSection={<IconPhoto size={16} />}
        value={file}
        onChange={onFileChange}
        clearable
        disabled={disabled}
      />
      {currentUrl && !removed && (
        <Text size="xs" c="dimmed">
          Deja vacío para conservar la imagen actual.
        </Text>
      )}
      {currentUrl && !file && !removed && (
        <Group gap="xs">
          <Image src={currentUrl} h={50} w="auto" fit="contain" radius="sm" />
          <Tooltip label="Quitar imagen">
            <ActionIcon variant="subtle" color="red" aria-label={`Quitar ${label.toLowerCase()}`} onClick={onRemove}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
      {progress !== null && <Progress value={progress} animated />}
    </Stack>
  );
}

function EditEventModal({
  event,
  onClose,
}: {
  event: EventInfo;
  onClose: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [bannerProgress, setBannerProgress] = useState<number | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [backgroundProgress, setBackgroundProgress] = useState<number | null>(null);
  const [appAndroidUrl, setAppAndroidUrl] = useState(event.appAndroidUrl ?? "");
  const [appIosUrl, setAppIosUrl] = useState(event.appIosUrl ?? "");
  const [wallEffectEnabled, setWallEffectEnabled] = useState(event.wallEffectEnabled);
  const [wallEffectColor, setWallEffectColor] = useState(event.wallEffectColor);
  const [wallEffectShape, setWallEffectShape] = useState<WallShape>(event.wallEffectShape);
  const [wallEffectOverScreensaver, setWallEffectOverScreensaver] = useState(event.wallEffectOverScreensaver);
  const [wallImageFile, setWallImageFile] = useState<File | null>(null);
  const [removeWallImage, setRemoveWallImage] = useState(false);
  const [wallImageProgress, setWallImageProgress] = useState<number | null>(null);
  const [wallScreens, setWallScreens] = useState<number | string>(event.wallScreens);
  // Una separación por hueco (1–2, 2–3…); al cambiar el número de tótems la lista se ajusta y los huecos
  // nuevos arrancan en DEFAULT_WALL_GAP_CM.
  const [wallGapsCm, setWallGapsCm] = useState<Array<number | string>>(event.wallGapsCm);
  const gapCount = typeof wallScreens === "number" && wallScreens >= 1 ? Math.min(11, Math.max(0, wallScreens - 1)) : 0;
  const visibleGaps = Array.from({ length: gapCount }, (_, i) => wallGapsCm[i] ?? DEFAULT_WALL_GAP_CM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (appAndroidUrl.trim() && !isHttpUrl(appAndroidUrl.trim())) {
      return setError("El enlace de Google Play debe ser una URL completa (https://…).");
    }
    if (appIosUrl.trim() && !isHttpUrl(appIosUrl.trim())) {
      return setError("El enlace de la App Store debe ser una URL completa (https://…).");
    }
    if (wallImageFile && wallImageFile.size > MAX_EVENT_IMAGE_BYTES) {
      return setError("La imagen del fondo animado no puede superar los 5 MB.");
    }
    if (wallEffectEnabled && wallEffectShape === "image" && !wallImageFile && (removeWallImage || !event.wallEffectImageUrl)) {
      return setError('Sube la imagen del fondo animado o elige otra figura.');
    }
    if (!/^#[0-9a-f]{6}$/i.test(wallEffectColor)) {
      return setError("El color de la esfera debe ser un color hexadecimal (ej. #3bc9db).");
    }
    if (typeof wallScreens !== "number" || wallScreens < 1 || wallScreens > 12) {
      return setError("La cantidad de tótems de la pared debe estar entre 1 y 12.");
    }
    if (visibleGaps.some((gap) => typeof gap !== "number" || gap < 0)) {
      return setError("Cada separación entre pantallas debe ser 0 o más centímetros.");
    }
    if (bannerFile && bannerFile.size > MAX_EVENT_IMAGE_BYTES) {
      return setError("La imagen del banner no puede superar los 5 MB.");
    }
    if (backgroundFile && backgroundFile.size > MAX_EVENT_IMAGE_BYTES) {
      return setError("La imagen de fondo no puede superar los 5 MB.");
    }

    setSaving(true);
    setError(null);
    try {
      const previousBannerUrl = event.bannerUrl;
      const previousBackgroundUrl = event.backgroundUrl;
      let bannerUrl = previousBannerUrl;
      let backgroundUrl = previousBackgroundUrl;

      if (bannerFile) {
        setBannerProgress(0);
        bannerUrl = await uploadEventImage(event.slug, "banner", bannerFile, setBannerProgress).promise;
      } else if (removeBanner) {
        bannerUrl = null;
      }

      if (backgroundFile) {
        setBackgroundProgress(0);
        backgroundUrl = await uploadEventImage(event.slug, "background", backgroundFile, setBackgroundProgress).promise;
      } else if (removeBackground) {
        backgroundUrl = null;
      }

      const previousWallImageUrl = event.wallEffectImageUrl;
      let wallEffectImageUrl = previousWallImageUrl;
      if (wallImageFile) {
        setWallImageProgress(0);
        wallEffectImageUrl = await uploadEventImage(event.slug, "wall", wallImageFile, setWallImageProgress).promise;
      } else if (removeWallImage) {
        wallEffectImageUrl = null;
      }

      await updateEvent(event.slug, {
        name: name.trim(),
        bannerUrl,
        backgroundUrl,
        appAndroidUrl: appAndroidUrl.trim() || null,
        appIosUrl: appIosUrl.trim() || null,
        wallEffectEnabled,
        wallEffectColor,
        wallEffectShape,
        wallEffectImageUrl,
        wallEffectOverScreensaver,
        wallScreens,
        wallGapsCm: visibleGaps as number[],
      });

      if (previousBannerUrl && previousBannerUrl !== bannerUrl) {
        // El evento ya quedó guardado con la imagen nueva (o sin imagen); la anterior es basura en Storage.
        deleteEventImage(previousBannerUrl).catch((err) => console.error("No se pudo borrar el banner anterior:", err));
      }
      if (previousWallImageUrl && previousWallImageUrl !== wallEffectImageUrl) {
        deleteEventImage(previousWallImageUrl).catch((err) =>
          console.error("No se pudo borrar la imagen anterior del fondo animado:", err)
        );
      }
      if (previousBackgroundUrl && previousBackgroundUrl !== backgroundUrl) {
        deleteEventImage(previousBackgroundUrl).catch((err) => console.error("No se pudo borrar el fondo anterior:", err));
      }

      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      setBannerProgress(null);
      setBackgroundProgress(null);
      setWallImageProgress(null);
    }
  };

  return (
    <Modal opened onClose={onClose} title="Editar evento" centered closeOnClickOutside={!saving} withCloseButton={!saving}>
      <Stack>
        <TextInput label="Nombre" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <EventImageField
          label="Imagen del banner"
          description="Cabecera del sitio público: ocupa el 100% del ancho y su alto se ajusta entre 80 y 200px según la pantalla. Tamaño ideal: 2000×200 px (horizontal, relación ~10:1) para que no se recorte en alto en desktop. Máx. 5 MB. Vacío = logo de ACHO por defecto."
          currentUrl={event.bannerUrl}
          file={bannerFile}
          onFileChange={(f) => {
            setBannerFile(f);
            if (f) setRemoveBanner(false);
          }}
          removed={removeBanner}
          onRemove={() => setRemoveBanner(true)}
          progress={bannerProgress}
          disabled={saving}
        />
        <EventImageField
          label="Imagen de fondo"
          description="Fondo de todo el sitio público del evento (cabecera y contenido), cubre la pantalla completa. Tamaño ideal: 1920×1080 px o más (horizontal). Máx. 5 MB. Vacío = sin fondo."
          currentUrl={event.backgroundUrl}
          file={backgroundFile}
          onFileChange={(f) => {
            setBackgroundFile(f);
            if (f) setRemoveBackground(false);
          }}
          removed={removeBackground}
          onRemove={() => setRemoveBackground(true)}
          progress={backgroundProgress}
          disabled={saving}
        />
        <Divider label="App móvil (QR)" labelPosition="left" />
        <Text size="xs" c="dimmed">
          Con al menos un enlace, el sitio público muestra un botón discreto arriba a la izquierda que abre un QR. El QR
          lleva a /{event.slug}/app, que abre la tienda según el celular: Google Play en Android, App Store en iPhone/iPad.
          Vacíos = sin botón.
        </Text>
        <TextInput
          label="Enlace de Google Play (Android)"
          placeholder="https://play.google.com/store/apps/details?id=…"
          value={appAndroidUrl}
          onChange={(e) => setAppAndroidUrl(e.currentTarget.value)}
          disabled={saving}
        />
        <TextInput
          label="Enlace de la App Store (iOS)"
          placeholder="https://apps.apple.com/app/…"
          value={appIosUrl}
          onChange={(e) => setAppIosUrl(e.currentTarget.value)}
          disabled={saving}
        />
        <Divider label="Fondo animado (pared de tótems)" labelPosition="left" />
        <Text size="xs" c="dimmed">
          Una corriente de figuras (esferas, plaquetas, células o imagen propia) que cruza de izquierda a derecha los tótems del evento puestos uno al lado del otro, como un solo fondo. Solo
          aparece en los tótems abiertos con su posición en la URL, de izquierda a derecha: /{event.slug}?pos=1, ?pos=2…
          Agrega &calibrar=1 para ver las guías y ajustar cada separación.
        </Text>
        <Switch
          label="Fondo animado activado"
          checked={wallEffectEnabled}
          onChange={(e) => setWallEffectEnabled(e.currentTarget.checked)}
          disabled={saving}
        />
        <Switch
          label="Mostrar también sobre el protector de pantalla"
          description="Las figuras pasan por encima de las fotos y videos del protector (solo las más cercanas). Tocar la pantalla lo sigue cerrando."
          checked={wallEffectOverScreensaver}
          onChange={(e) => setWallEffectOverScreensaver(e.currentTarget.checked)}
          disabled={saving}
        />
        <Select
          label="Figura"
          value={wallEffectShape}
          onChange={(value) => {
            if (!value) return;
            const shape = value as WallShape;
            setWallEffectShape(shape);
            // Al cambiar de figura se propone su color típico (se puede ajustar después).
            if (shape !== "image") setWallEffectColor(WALL_SHAPE_DEFAULT_COLORS[shape]);
          }}
          data={[
            { value: "sphere", label: "Esfera de luz" },
            { value: "platelet", label: "Plaqueta (hematología)" },
            { value: "cancerCell", label: "Célula cancerígena (oncología)" },
            { value: "image", label: "Imagen propia" },
          ]}
          allowDeselect={false}
          disabled={saving}
        />
        {wallEffectShape === "image" && (
          <EventImageField
            label="Imagen de la figura"
            description="PNG con fondo transparente, cuadrado (ej. 1000×1000 px). Máx. 5 MB. Asegúrate de tener la licencia de uso de la imagen."
            currentUrl={event.wallEffectImageUrl}
            file={wallImageFile}
            onFileChange={(f) => {
              setWallImageFile(f);
              if (f) setRemoveWallImage(false);
            }}
            removed={removeWallImage}
            onRemove={() => setRemoveWallImage(true)}
            progress={wallImageProgress}
            disabled={saving}
          />
        )}
        <ColorInput
          label={wallEffectShape === "image" ? "Color del brillo" : "Color de la figura"}
          value={wallEffectColor}
          onChange={setWallEffectColor}
          format="hex"
          swatches={["#3bc9db", "#c92a2a", "#ae3ec9", "#40c057", "#228be6", "#fab005"]}
          disabled={saving}
        />
        <NumberInput
          label="Tótems en la pared"
          value={wallScreens}
          onChange={setWallScreens}
          min={1}
          max={12}
          allowDecimal={false}
          disabled={saving}
        />
        {gapCount > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Separación entre pantallas (cm)
            </Text>
            <Text size="xs" c="dimmed">
              Distancia entre el borde de la imagen de una pantalla y el de la siguiente, para cada par de tótems vecinos
              (de izquierda a derecha).
            </Text>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
              {visibleGaps.map((gap, i) => (
                <NumberInput
                  key={i}
                  label={`Tótems ${i + 1} – ${i + 2}`}
                  value={gap}
                  onChange={(value) =>
                    setWallGapsCm((prev) => {
                      const next = Array.from({ length: gapCount }, (_, j) => prev[j] ?? DEFAULT_WALL_GAP_CM);
                      next[i] = value;
                      return next;
                    })
                  }
                  min={0}
                  decimalScale={1}
                  disabled={saving}
                />
              ))}
            </SimpleGrid>
          </Stack>
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

const TABS_BEFORE_FIELDS = [
  { value: "papers", label: "Papers" },
  { value: "fields", label: "Campos" },
];

const TABS_AFTER_FIELDS = [
  { value: "voters", label: "Votantes" },
  { value: "results", label: "Resultados" },
  { value: "screensaver", label: "Protector de pantalla" },
];

function EventFrame() {
  const { eventSlug, status, event, fields } = useAdminEvent();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const backLink = (
    <Anchor component={Link} to="/admin" size="sm">
      <Group gap={4}>
        <IconArrowLeft size={14} />
        Eventos
      </Group>
    </Anchor>
  );

  if (status === "loading") {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }
  if (status === "not-found" || status === "error" || !event) {
    return (
      <Stack gap="sm">
        {backLink}
        <Alert color="red">
          {status === "not-found"
            ? "No existe un evento con ese identificador."
            : "No se pudo cargar el evento. Verifica tu conexión y tus permisos."}
        </Alert>
      </Stack>
    );
  }

  // Cada campo de lista tiene su propia pestaña (fields/:fieldId) para administrar sus opciones.
  const tabs = [
    ...TABS_BEFORE_FIELDS,
    ...fields.filter(isListField).map((f) => ({ value: `fields/${f.id}`, label: f.label })),
    ...TABS_AFTER_FIELDS,
  ];
  const [, , , segment = "", subSegment] = location.pathname.split("/");
  const tabValue = segment === "fields" && subSegment ? `fields/${subSegment}` : segment;
  const activeTab = tabs.some((t) => t.value === tabValue) ? tabValue : "papers";

  const updateVoteMode = async (mode: VoteMode) => {
    setError(null);
    try {
      await updateEvent(eventSlug, { voteMode: mode });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el modo de votación.");
    }
  };

  const voteModeDescription: Record<VoteMode, string> = {
    registered: 'Solo pueden votar cédulas precargadas y activas en "Votantes".',
    open: 'Cualquier número de identificación puede votar (una vez por número), sin necesidad de estar en "Votantes".',
    anonymous: "No se pide ningún dato: el voto queda asociado al navegador (una vez por dispositivo/navegador).",
  };

  const toggleSearchQuestions = async (enabled: boolean) => {
    setError(null);
    try {
      await updateEvent(eventSlug, { searchQuestionsEnabled: enabled });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el estado de las preguntas con IA.");
    }
  };

  const toggleSearchExplanations = async (enabled: boolean) => {
    setError(null);
    try {
      await updateEvent(eventSlug, { searchExplanationsEnabled: enabled });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el estado de las explicaciones de búsqueda.");
    }
  };

  const updatePublicStyle = async (publicStyle: PublicStyle) => {
    setError(null);
    try {
      await updateEvent(eventSlug, { publicStyle });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el estilo del sitio público.");
    }
  };

  const toggleTouchKeyboard = async (enabled: boolean) => {
    setError(null);
    try {
      await updateEvent(eventSlug, { touchKeyboardEnabled: enabled });
    } catch (e) {
      console.error(e);
      setError("No se pudo cambiar el estado del teclado en pantalla.");
    }
  };

  return (
    <Stack gap="md">
      {backLink}
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            <Title order={3}>{event.name}</Title>
            <Tooltip label="Editar evento">
              <ActionIcon variant="subtle" aria-label="Editar evento" onClick={() => setEditing(true)}>
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group gap="xs">
            <Code>/{eventSlug}</Code>
            <Anchor href={`/${eventSlug}`} target="_blank" rel="noreferrer" size="sm">
              <Group gap={4}>
                Ver sitio público
                <IconExternalLink size={14} />
              </Group>
            </Anchor>
          </Group>
        </Stack>
        <Stack gap="xs" align="flex-end">
          <VotingControl event={event} onError={setError} />
          <Stack gap={2} align="flex-end">
            <SegmentedControl
              size="xs"
              value={event.voteMode}
              onChange={(value) => void updateVoteMode(value as VoteMode)}
              data={[
                { label: "Con registro", value: "registered" },
                { label: "Sin registro", value: "open" },
                { label: "Anónimo", value: "anonymous" },
              ]}
            />
            <Text size="xs" c="dimmed" ta="right" maw={320}>
              {voteModeDescription[event.voteMode]}
            </Text>
          </Stack>
          <Stack gap={2} align="flex-end">
            <Switch
              size="md"
              checked={event.searchExplanationsEnabled}
              onChange={(e) => void toggleSearchExplanations(e.currentTarget.checked)}
              label={event.searchExplanationsEnabled ? "Explicaciones de búsqueda activadas" : "Explicaciones de búsqueda desactivadas"}
            />
            <Text size="xs" c="dimmed" ta="right" maw={320}>
              Muestra "¿Por qué este resultado?" en los resultados de la búsqueda conceptual. Cada explicación usa IA (Gemini).
            </Text>
          </Stack>
          <Stack gap={2} align="flex-end">
            <Switch
              size="md"
              checked={event.searchQuestionsEnabled}
              onChange={(e) => void toggleSearchQuestions(e.currentTarget.checked)}
              label={event.searchQuestionsEnabled ? "Preguntas con IA activadas" : "Preguntas con IA desactivadas"}
            />
            <Text size="xs" c="dimmed" ta="right" maw={320}>
              Agrega el modo "Preguntar" al buscador: los visitantes escriben una pregunta y reciben una respuesta breve con
              los pósters agrupados por tema. Cada pregunta nueva usa IA (Gemini); las repetidas salen de caché.
            </Text>
          </Stack>
          <Stack gap={2} align="flex-end">
            <SegmentedControl
              size="xs"
              value={event.publicStyle}
              onChange={(value) => void updatePublicStyle(value as PublicStyle)}
              data={[
                { label: "Oscuro (nuevo)", value: "glass" },
                { label: "Clásico", value: "classic" },
              ]}
            />
            <Text size="xs" c="dimmed" ta="right" maw={320}>
              Estilo del sitio público. Oscuro: fondo oscurecido, tarjetas de vidrio y bordes luminosos en el color de
              cada opción. Clásico: el estilo claro anterior.
            </Text>
          </Stack>
          <Stack gap={2} align="flex-end">
            <Switch
              size="md"
              checked={event.touchKeyboardEnabled}
              onChange={(e) => void toggleTouchKeyboard(e.currentTarget.checked)}
              label={event.touchKeyboardEnabled ? "Teclado en pantalla activado" : "Teclado en pantalla desactivado"}
            />
            <Text size="xs" c="dimmed" ta="right" maw={320}>
              Solo en tótems verticales: muestra un teclado propio al tocar un campo de texto. Desactivado, se usa el
              teclado del sistema (en Windows, el teclado táctil si está configurado).
            </Text>
          </Stack>
        </Stack>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      <Tabs value={activeTab} onChange={(value) => value && navigate(`/admin/${eventSlug}/${value}`)}>
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Outlet />

      {editing && <EditEventModal event={event} onClose={() => setEditing(false)} />}
    </Stack>
  );
}

export default function AdminEventLayout() {
  const { eventSlug = "" } = useParams<{ eventSlug: string }>();

  // key reinicia las suscripciones al cambiar de evento
  return (
    <AdminEventProvider key={eventSlug} eventSlug={eventSlug}>
      <EventFrame />
    </AdminEventProvider>
  );
}
