#!/usr/bin/env node
// Evaluación de la búsqueda conceptual contra un conjunto de consultas con sus pósters relevantes
// (conjunto de prueba), para juzgar con números cualquier cambio de umbrales, modelo o indexado.
// Solo lee: datos públicos de Firestore (REST) y la función pública embedSearchQuery (una llamada
// a Gemini por consulta, costo mínimo). Ver README.md en esta carpeta.
//
//   node scripts/search-eval/evaluate.mjs scripts/search-eval/queries/<evento>.json [--verbose] [--sweep]
//   node scripts/search-eval/evaluate.mjs --candidates <evento> "<consulta>" [n]

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = process.env.FIREBASE_PROJECT ?? "gen-papers";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const FUNCTIONS = `https://us-central1-${PROJECT}.cloudfunctions.net`;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Umbrales que usa el sitio, leídos de PostersContext.tsx para no tener que mantenerlos en dos lugares.
function readClientParams() {
  const source = readFileSync(resolve(REPO_ROOT, "src/context/PostersContext.tsx"), "utf8");
  const read = (name) => {
    const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
    if (!match) throw new Error(`No se encontró ${name} en PostersContext.tsx`);
    return Number(match[1]);
  };
  return { threshold: read("SEMANTIC_THRESHOLD"), window: read("SEMANTIC_RELATIVE_WINDOW") };
}

const docId = (doc) => doc.name.split("/").pop();
const numberValue = (v) => (v.doubleValue !== undefined ? v.doubleValue : Number(v.integerValue));

async function listCollection(path, fieldPaths) {
  const docs = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ pageSize: "300" });
    fieldPaths.forEach((f) => params.append("mask.fieldPaths", f));
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${FIRESTORE}/${path}?${params}`);
    if (!response.ok) throw new Error(`Firestore ${path}: HTTP ${response.status}`);
    const body = await response.json();
    docs.push(...(body.documents ?? []));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return docs;
}

// Papers del evento con su embedding (los que no tienen embedding no participan, igual que en el sitio).
async function loadEvent(eventSlug) {
  const [papers, index] = await Promise.all([
    listCollection(`events/${eventSlug}/papers`, ["title"]),
    listCollection(`events/${eventSlug}/paperSearchIndex`, ["embedding", "status"]),
  ]);
  if (!papers.length) throw new Error(`El evento "${eventSlug}" no tiene papers (¿slug correcto?).`);
  const embeddings = new Map(
    index
      .filter((d) => d.fields?.embedding?.arrayValue?.values?.length)
      .map((d) => [docId(d), d.fields.embedding.arrayValue.values.map(numberValue)])
  );
  return papers.map((d) => ({
    id: docId(d),
    title: d.fields?.title?.stringValue ?? "",
    embedding: embeddings.get(docId(d)) ?? null,
    status: index.find((i) => docId(i) === docId(d))?.fields?.status?.stringValue ?? "sin índice",
  }));
}

async function embedQuery(query) {
  const response = await fetch(`${FUNCTIONS}/embedSearchQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { query } }),
  });
  const body = await response.json();
  if (!body.result?.embedding) throw new Error(`embedSearchQuery("${query}"): ${JSON.stringify(body.error ?? body)}`);
  return body.result.embedding;
}

const cosine = (a, b) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

// Puntajes de todos los papers con embedding, de mayor a menor.
const scorePapers = (papers, queryEmbedding) =>
  papers
    .filter((p) => p.embedding)
    .map((p) => ({ ...p, score: cosine(queryEmbedding, p.embedding) }))
    .sort((a, b) => b.score - a.score);

// Mismo corte que PostersContext: piso absoluto y ventana relativa al mejor puntaje de la consulta.
const cutoffFor = (scored, { threshold, window }) => Math.max(threshold, (scored[0]?.score ?? 0) - window);
const retrieve = (scored, params) => {
  const cutoff = cutoffFor(scored, params);
  return scored.filter((p) => p.score >= cutoff);
};

function metrics(retrieved, relevantIds) {
  const hits = retrieved.filter((p) => relevantIds.has(p.id)).length;
  const precision = retrieved.length ? hits / retrieved.length : relevantIds.size ? 0 : 1;
  const recall = relevantIds.size ? hits / relevantIds.size : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { hits, precision, recall, f1 };
}

const mean = (values) => values.reduce((s, v) => s + v, 0) / (values.length || 1);
const pct = (v) => `${(v * 100).toFixed(0)}%`.padStart(5);

async function evaluate(file, { verbose, sweep }) {
  const spec = JSON.parse(readFileSync(file, "utf8"));
  const params = readClientParams();
  const papers = await loadEvent(spec.event);
  const byId = new Map(papers.map((p) => [p.id, p]));
  const withEmbedding = papers.filter((p) => p.embedding).length;

  console.log(`Evento: ${spec.event} — ${papers.length} papers, ${withEmbedding} con embedding`);
  console.log(`Parámetros del sitio: umbral ${params.threshold}, ventana ${params.window}`);
  if (spec.validated !== true) {
    console.log("AVISO: este conjunto de prueba es un borrador sin validar (\"validated\": false); los números son orientativos.");
  }
  console.log("");

  const cases = [];
  for (const q of spec.queries) {
    const relevantIds = new Set(q.relevant.map((r) => r.id));
    q.relevant.forEach((r) => {
      if (!byId.has(r.id)) console.log(`AVISO: "${q.query}" espera un paper que ya no existe: ${r.id} (${r.title ?? ""})`);
    });
    const scored = scorePapers(papers, await embedQuery(q.query));
    cases.push({ query: q.query, relevantIds, scored });
  }

  const report = (p) => cases.map((c) => ({ ...c, retrieved: retrieve(c.scored, p) })).map((c) => ({ ...c, ...metrics(c.retrieved, c.relevantIds) }));
  const current = report(params);

  console.log(`${"consulta".padEnd(44)} esper. devue. acier.  prec.  cobert.`);
  for (const c of current) {
    console.log(
      `${c.query.slice(0, 43).padEnd(44)} ${String(c.relevantIds.size).padStart(6)} ${String(c.retrieved.length).padStart(6)} ${String(c.hits).padStart(6)}  ${pct(c.precision)}  ${pct(c.recall)}`
    );
    if (verbose) {
      const rankOf = new Map(c.scored.map((p, i) => [p.id, i + 1]));
      c.retrieved
        .filter((p) => !c.relevantIds.has(p.id))
        .forEach((p) => console.log(`     + sobra   ${p.score.toFixed(3)}  ${p.title.slice(0, 90)}`));
      [...c.relevantIds]
        .filter((id) => !c.retrieved.some((p) => p.id === id))
        .forEach((id) => {
          const p = c.scored.find((s) => s.id === id);
          const detail = p ? `${p.score.toFixed(3)} (puesto ${rankOf.get(id)})` : `sin embedding (${byId.get(id)?.status ?? "no existe"})`;
          console.log(`     - falta   ${detail}  ${(byId.get(id)?.title ?? id).slice(0, 90)}`);
        });
    }
  }
  const summarize = (rows) => ({
    precision: mean(rows.map((r) => r.precision)),
    recall: mean(rows.map((r) => r.recall)),
    f1: mean(rows.map((r) => r.f1)),
  });
  const total = summarize(current);
  console.log(`\nPromedio: precisión ${pct(total.precision)}, cobertura ${pct(total.recall)}, F1 ${pct(total.f1)}`);

  if (sweep) {
    const grid = [];
    for (let t = 0.5; t <= 0.76; t += 0.01) {
      for (let w = 0.02; w <= 0.121; w += 0.01) {
        const p = { threshold: Number(t.toFixed(2)), window: Number(w.toFixed(2)) };
        grid.push({ ...p, ...summarize(report(p)) });
      }
    }
    grid.sort((a, b) => b.f1 - a.f1);
    console.log("\nMejores combinaciones (barrido de umbral y ventana, por F1 promedio):");
    grid.slice(0, 5).forEach((g) =>
      console.log(`  umbral ${g.threshold.toFixed(2)}, ventana ${g.window.toFixed(2)} → F1 ${pct(g.f1)} (precisión ${pct(g.precision)}, cobertura ${pct(g.recall)})`)
    );
    console.log("Con pocas consultas el barrido se sobreajusta: cambia los umbrales del sitio solo si la mejora se repite en varios eventos.");
  }
}

// Ayuda para armar el conjunto de prueba: muestra los mejores candidatos de una consulta con su puntaje.
async function candidates(eventSlug, query, n) {
  const params = readClientParams();
  const papers = await loadEvent(eventSlug);
  const scored = scorePapers(papers, await embedQuery(query));
  const cutoff = cutoffFor(scored, params);
  console.log(`"${query}" en ${eventSlug} — corte actual ${cutoff.toFixed(3)} (✓ = lo devolvería el sitio)\n`);
  scored.slice(0, n).forEach((p, i) =>
    console.log(`${String(i + 1).padStart(3)} ${p.score >= cutoff ? "✓" : " "} ${p.score.toFixed(3)}  ${p.id}  ${p.title.slice(0, 100)}`)
  );
  const missing = papers.filter((p) => !p.embedding);
  if (missing.length) console.log(`\n${missing.length} papers sin embedding no participan: ${missing.map((p) => p.id).join(", ")}`);
}

const args = process.argv.slice(2);
try {
  if (args[0] === "--candidates") {
    if (!args[1] || !args[2]) throw new Error('Uso: --candidates <evento> "<consulta>" [n]');
    await candidates(args[1], args[2], Number(args[3] ?? 25));
  } else {
    const file = args.find((a) => !a.startsWith("--"));
    if (!file) throw new Error("Uso: evaluate.mjs <queries.json> [--verbose] [--sweep]  |  --candidates <evento> \"<consulta>\" [n]");
    await evaluate(resolve(file), { verbose: args.includes("--verbose"), sweep: args.includes("--sweep") });
  }
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
