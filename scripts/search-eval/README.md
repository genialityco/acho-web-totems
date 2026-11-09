# Evaluación de la búsqueda conceptual

`evaluate.mjs` mide qué tan bien la búsqueda conceptual (embeddings + similitud coseno) devuelve los pósters correctos, usando un **conjunto de prueba**: consultas con la lista de pósters que deberían salir. Sirve para decidir con números cualquier cambio en los umbrales (`SEMANTIC_THRESHOLD` / `SEMANTIC_RELATIVE_WINDOW` de `src/context/PostersContext.tsx`, que el script lee de ahí), en el modelo o en cómo se indexa.

Solo lee: datos públicos de Firestore y la función pública `embedSearchQuery` (una llamada a Gemini por consulta). No necesita credenciales. Requiere Node 18+.

## Uso

```
# Evaluar un conjunto de prueba con los umbrales actuales del sitio
node scripts/search-eval/evaluate.mjs scripts/search-eval/queries/congreso-nacional-acho-2026-oncologia.json

#   --verbose  lista, por consulta, los pósters que sobran y los que faltan (con su puntaje y puesto)
#   --sweep    prueba combinaciones de umbral y ventana y muestra las mejores por F1

# Ver los mejores candidatos de una consulta (para armar o corregir un conjunto de prueba)
node scripts/search-eval/evaluate.mjs --candidates congreso-nacional-acho-2026-oncologia "inmunoterapia" 30
```

Por consulta muestra **precisión** (de lo que devolvió, cuánto era relevante) y **cobertura** (de lo relevante, cuánto devolvió); al final, el promedio y el F1.

## Conjuntos de prueba (`queries/<evento>.json`)

```json
{
  "event": "slug-del-evento",
  "validated": false,
  "queries": [
    { "query": "cáncer de mama triple negativo", "relevant": [{ "id": "<paperId>", "title": "<solo para leerlo>" }] }
  ]
}
```

`queries/congreso-nacional-acho-2026-oncologia.json` es un **borrador** generado con reglas de palabras clave sobre los títulos (`validated: false`): le faltan pósters relevantes cuyo título no lo dice, y puede sobrar alguno. Para validarlo, alguien que conozca los trabajos revisa cada consulta con `--candidates` y `--verbose`, ajusta `relevant` y pone `validated: true`. Mientras siga en borrador, los números son orientativos.

## Cuándo correrlo

- Después de cambiar el indexado (ej. `INDEX_VERSION` en `functions/src/lib/paperMetadata.ts`) y re-indexar: comparar contra el resultado anterior.
- Antes de cambiar los umbrales del sitio: correr `--sweep` en **varios** eventos; con pocas consultas el barrido se sobreajusta.
