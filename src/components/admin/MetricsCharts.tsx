import { useEffect, useMemo, useState } from "react";
import { Card, Group, Select, SegmentedControl, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { AreaChart, BarChart } from "@mantine/charts";
import { useAdminEvent } from "../../context/useAdminEvent";
import { DailyMetric, subscribeDailyMetrics } from "../../services/firestore/paperMetricsService";

const ALL = "__all__";
type Range = "7" | "14" | "30" | "all";

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
// "2026-09-30" -> "30 sep"
const shortLabel = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Title order={3}>{value}</Title>
      {hint && (
        <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
          {hint}
        </Text>
      )}
    </Card>
  );
}

// Gráficas de comportamiento: uso por día (vistas, descargas, votos) y por póster.
export default function MetricsCharts() {
  const { eventSlug, papers, votes } = useAdminEvent();
  const [days, setDays] = useState<DailyMetric[]>([]);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<Range>("14");
  const [paperId, setPaperId] = useState<string>(ALL);

  useEffect(() => subscribeDailyMetrics(eventSlug, setDays, () => setError(true)), [eventSlug]);

  // Serie continua de días (los días sin actividad cuentan como 0).
  const series = useMemo(() => {
    const byDay = new Map(days.map((d) => [d.date, d]));
    const votesByDay = new Map<string, number>();
    votes.forEach((v) => {
      if (!v.castAt) return;
      const k = dayKey(v.castAt);
      votesByDay.set(k, (votesByDay.get(k) ?? 0) + 1);
    });
    const today = dayKey(new Date());
    const first = [...byDay.keys(), ...votesByDay.keys()].sort()[0] ?? today;
    const span = range === "all" ? null : Number(range);

    const keys: string[] = [];
    const cursor = new Date(`${today}T12:00:00`);
    const start = new Date(`${first}T12:00:00`);
    for (let i = 0; i < 400; i++) {
      if (span ? i >= span : cursor < start) break;
      keys.unshift(dayKey(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }

    return keys.map((k) => {
      const d = byDay.get(k);
      const p = paperId === ALL ? undefined : d?.papers[paperId];
      return {
        key: k,
        Fecha: shortLabel(k),
        Vistas: paperId === ALL ? d?.views ?? 0 : p?.views ?? 0,
        Descargas: paperId === ALL ? d?.downloads ?? 0 : p?.downloads ?? 0,
        Votos: votesByDay.get(k) ?? 0,
      };
    });
  }, [days, votes, range, paperId]);

  // Ranking de pósters por vistas dentro del rango seleccionado.
  const topPapers = useMemo(() => {
    const keys = new Set(series.map((s) => s.key));
    const totals = new Map<string, { views: number; downloads: number }>();
    days
      .filter((d) => keys.has(d.date))
      .forEach((d) =>
        Object.entries(d.papers).forEach(([id, m]) => {
          const t = totals.get(id) ?? { views: 0, downloads: 0 };
          t.views += m.views;
          t.downloads += m.downloads;
          totals.set(id, t);
        })
      );
    const title = new Map(papers.map((p) => [p.id, p.title]));
    return [...totals.entries()]
      .filter(([id]) => title.has(id))
      .map(([id, t]) => {
        const name = title.get(id) ?? "";
        return { Póster: name.length > 38 ? `${name.slice(0, 37)}…` : name, Vistas: t.views, Descargas: t.downloads };
      })
      .sort((a, b) => b.Vistas - a.Vistas || b.Descargas - a.Descargas)
      .slice(0, 10);
  }, [days, series, papers]);

  const totalViews = series.reduce((s, d) => s + d.Vistas, 0);
  const totalDownloads = series.reduce((s, d) => s + d.Descargas, 0);
  const peak = series.reduce((best, d) => (d.Vistas > best.Vistas ? d : best), series[0]);
  const today = series[series.length - 1];
  const avg = series.length ? (totalViews / series.length).toFixed(1) : "0";
  const conversion = totalViews > 0 ? `${Math.round((totalDownloads / totalViews) * 100)}%` : "—";

  const paperOptions = [
    { value: ALL, label: "Todos los pósters" },
    ...papers.map((p) => ({ value: p.id, label: p.title })),
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Title order={5}>Comportamiento por día</Title>
        <Group gap="sm">
          <Select
            aria-label="Póster"
            data={paperOptions}
            value={paperId}
            onChange={(v) => setPaperId(v ?? ALL)}
            searchable
            allowDeselect={false}
            w={{ base: "100%", sm: 280 }}
          />
          <SegmentedControl
            value={range}
            onChange={(v) => setRange(v as Range)}
            data={[
              { value: "7", label: "7 días" },
              { value: "14", label: "14 días" },
              { value: "30", label: "30 días" },
              { value: "all", label: "Todo" },
            ]}
          />
        </Group>
      </Group>

      {error && (
        <Text c="red" size="sm">
          No se pudieron cargar las métricas diarias.
        </Text>
      )}

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Kpi label="Vistas hoy" value={today?.Vistas ?? 0} hint={`${today?.Descargas ?? 0} descargas`} />
        <Kpi label="Promedio de vistas/día" value={avg} hint={`${totalViews} en el periodo`} />
        <Kpi
          label="Día pico"
          value={peak && peak.Vistas > 0 ? `${peak.Vistas} vistas` : "—"}
          hint={peak && peak.Vistas > 0 ? peak.Fecha : undefined}
        />
        <Kpi label="Descargas / vistas" value={conversion} hint={`${totalDownloads} descargas`} />
      </SimpleGrid>

      <Card withBorder padding="md">
        <Text fw={500} mb="sm">
          Vistas, descargas y votos por día
        </Text>
        <AreaChart
          h={280}
          data={series}
          dataKey="Fecha"
          series={[
            { name: "Vistas", color: "blue.6" },
            { name: "Descargas", color: "teal.6" },
            { name: "Votos", color: "orange.6" },
          ]}
          curveType="monotone"
          withLegend
          legendProps={{ verticalAlign: "bottom", height: 40 }}
          tickLine="y"
          gridAxis="xy"
          yAxisProps={{ allowDecimals: false }}
        />
      </Card>

      <Card withBorder padding="md">
        <Text fw={500} mb="sm">
          Pósters más vistos ({range === "all" ? "todo el periodo" : `últimos ${range} días`})
        </Text>
        {topPapers.length === 0 ? (
          <Text c="dimmed" size="sm">
            Aún no hay vistas registradas por día. Los datos diarios se acumulan desde que se activó este registro.
          </Text>
        ) : (
          <BarChart
            h={Math.max(240, topPapers.length * 36)}
            data={topPapers}
            dataKey="Póster"
            orientation="vertical"
            series={[
              { name: "Vistas", color: "blue.6" },
              { name: "Descargas", color: "teal.6" },
            ]}
            withLegend
            legendProps={{ verticalAlign: "bottom", height: 40 }}
            yAxisProps={{ width: 220 }}
            xAxisProps={{ allowDecimals: false }}
            gridAxis="x"
          />
        )}
      </Card>
    </Stack>
  );
}
