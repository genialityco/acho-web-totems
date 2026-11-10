import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconCalendarTime } from "@tabler/icons-react";
import { EventInfo, updateEvent } from "../../services/firestore/eventService";
import { errorMessage } from "../../services/firestore/batch";
import { useVotingPhase } from "../../hooks/useVotingPhase";
import { VotingPhase } from "../../utils/votingSchedule";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);

// <input type="datetime-local"> trabaja con "YYYY-MM-DDTHH:mm" en la hora local del navegador.
const toInputValue = (date: Date | null) => {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromInputValue = (value: string) => (value ? new Date(value) : null);

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m ${s}s`;
};

const PHASE_LABEL: Record<VotingPhase, string> = {
  closed: "Votación cerrada",
  scheduled: "Votación programada",
  open: "Votación abierta",
  ended: "Votación finalizada",
};

function VotingScheduleModal({ event, onClose }: { event: EventInfo; onClose: () => void }) {
  const [opensAt, setOpensAt] = useState(toInputValue(event.votingOpensAt));
  const [closesAt, setClosesAt] = useState(toInputValue(event.votingClosesAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (votingOpensAt: Date | null, votingClosesAt: Date | null) => {
    if (votingOpensAt && votingClosesAt && votingClosesAt <= votingOpensAt) {
      return setError("El cierre debe ser posterior a la apertura.");
    }
    setSaving(true);
    setError(null);
    try {
      // Programar una apertura habilita la votación: así abre sola en la fecha, sin tener que
      // acordarse de encender el interruptor (que sigue sirviendo para cerrarla a mano).
      await updateEvent(event.slug, { votingOpensAt, votingClosesAt, ...(votingOpensAt && { votingOpen: true }) });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title="Programar votación" centered closeOnClickOutside={!saving}>
      <Stack>
        <Text size="sm" c="dimmed">
          Fechas en la hora de este equipo. Aplican al sitio público (landing y tótems) y a cualquier voto que llegue
          al servidor. Al programar una apertura la votación queda habilitada y abre sola en esa fecha; el interruptor
          sigue cerrándola manualmente en cualquier momento. Deja un campo vacío para no limitar ese lado.
        </Text>
        <TextInput
          type="datetime-local"
          label="Apertura"
          description="Antes de esta fecha la landing muestra la cuenta regresiva para la apertura."
          value={opensAt}
          onChange={(e) => setOpensAt(e.currentTarget.value)}
          disabled={saving}
        />
        <TextInput
          type="datetime-local"
          label="Cierre"
          description="Mientras la votación está abierta, la landing muestra la cuenta regresiva para el cierre."
          value={closesAt}
          onChange={(e) => setClosesAt(e.currentTarget.value)}
          disabled={saving}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="space-between">
          <Button
            variant="subtle"
            color="red"
            onClick={() => void save(null, null)}
            disabled={saving || (!event.votingOpensAt && !event.votingClosesAt)}
          >
            Quitar programación
          </Button>
          <Group>
            <Button variant="default" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save(fromInputValue(opensAt), fromInputValue(closesAt))} loading={saving}>
              Guardar
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

// Interruptor de la votación + su programación. Componente aparte para que el tic de cada segundo
// (useVotingPhase) no re-renderice todo el layout del evento con sus tablas.
export default function VotingControl({ event, onError }: { event: EventInfo; onError: (message: string) => void }) {
  const { phase, now } = useVotingPhase(event);
  const [scheduling, setScheduling] = useState(false);

  const toggleVoting = async (open: boolean) => {
    try {
      await updateEvent(event.slug, { votingOpen: open });
    } catch (e) {
      console.error(e);
      onError("No se pudo cambiar el estado de la votación.");
    }
  };

  let status = "Cuando está cerrada nadie puede votar.";
  if (phase === "scheduled" && event.votingOpensAt) {
    status = `Abre el ${formatDate(event.votingOpensAt)} (en ${formatRemaining(event.votingOpensAt.getTime() - now)}).`;
  } else if (phase === "open" && event.votingClosesAt) {
    status = `Cierra el ${formatDate(event.votingClosesAt)} (en ${formatRemaining(event.votingClosesAt.getTime() - now)}).`;
  } else if (phase === "ended" && event.votingClosesAt) {
    status = `Cerró el ${formatDate(event.votingClosesAt)}.`;
  } else if (phase === "closed" && event.votingOpensAt) {
    status = `Cerrada manualmente: la apertura programada (${formatDate(event.votingOpensAt)}) no aplica mientras el interruptor esté apagado.`;
  }

  return (
    <Stack gap={2} align="flex-end">
      <Group gap="xs">
        <Button
          size="compact-xs"
          variant="light"
          leftSection={<IconCalendarTime size={14} />}
          onClick={() => setScheduling(true)}
        >
          Programar
        </Button>
        <Switch
          size="md"
          checked={event.votingOpen}
          onChange={(e) => void toggleVoting(e.currentTarget.checked)}
          label={phase ? PHASE_LABEL[phase] : ""}
        />
      </Group>
      <Text size="xs" c="dimmed" ta="right" maw={360}>
        {status}
      </Text>
      {scheduling && <VotingScheduleModal event={event} onClose={() => setScheduling(false)} />}
    </Stack>
  );
}
