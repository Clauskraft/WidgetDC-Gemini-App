# MCP Bridge — postMessage Origin-regler

> CFDS §9 / `@widgetdc/contracts` — gælder for `embed_url` leveret via `POST /api/mrp/canvas/resolve`.

## Oversigt

Canvas-embed ( `/embed/canvas/:canvasId` ) kommunikerer med host via `window.postMessage`. Af sikkerhedsmæssige årsager validerer broen **både** origin **og** kontrakt-schema før beskeder accepteres.

| Regel | Implementering |
|-------|----------------|
| **Origin allow-list** | `allowedOrigins` parameter på `useCanvasBridge` — uden match → `canvas:error { code: "origin_not_allowed" }` |
| **Contract-version** | Kun `"widgetdc.bridge.v1"` accepteres — ellers → `canvas:error { code: "wrong_contract_version" }` |
| **Schema-validering** | Zod `BridgeMessageSchema` (v, contract, canvas_id, type, payload, ts) — ellers → `canvas:error { code: "invalid_schema" }` |
| **Canvas ID match** | `canvas_id` i besked skal matche embed'ets eget ID — ellers → `canvas:error { code: "canvas_id_mismatch" }` |

## Tilladte origins

Allow-listen parses med `new URL(a).origin === new URL(origin).origin` — dvs. protokol + host + port skal matche eksakt.

### Eksempler: tilladt

| Allow-list | Host origin | Resultat |
|------------|-------------|----------|
| `["https://host.example"]` | `https://host.example` | ✅ Tilladt |
| `["https://host.example"]` | `https://host.example:443` | ✅ Tilladt (standardport implicit) |
| `["https://host.example:8443"]` | `https://host.example:8443` | ✅ Tilladt |
| `["*"]` | `https://evil.com` | ✅ Tilladt (wildcard — kun eksplicit) |
| `["https://localhost:3000"]` | `https://localhost:3000` | ✅ Tilladt (dev / lokal testing) |
| `["http://localhost:3000", "https://app.widgetdc.io"]` | `http://localhost:3000` | ✅ Tilladt (multi-origin allow-list) |
| `["https://app.widgetdc.io", "https://admin.widgetdc.io"]` | `https://admin.widgetdc.io` | ✅ Tilladt (subdomæne matcher eksakt) |

### Eksempler: afvist

| Allow-list | Host origin | Resultat |
|------------|-------------|----------|
| `["https://host.example"]` | `https://attacker.example` | ❌ `origin_not_allowed` |
| `["https://host.example"]` | `https://sub.host.example` | ❌ `origin_not_allowed` (suffix-trick) |
| `["https://host.example"]` | `http://host.example` | ❌ `origin_not_allowed` (forkert protokol) |
| `["https://host.example:8443"]` | `https://host.example:443` | ❌ `origin_not_allowed` (forkert port) |
| `["https://host.example"]` | `"null"` | ❌ `origin_not_allowed` (opaque origin, fx `file://`) |
| `["https://host.example"]` | `""` / `undefined` | ❌ `origin_not_allowed` |
| `["https://host.example"]` | `https://host.example:8080` | ❌ `origin_not_allowed` (eksplicit port mismatch) |
| `["https://host.example"]` | `https://Host.Example` | ❌ `origin_not_allowed` (case-sensitiv host — `Host.Example` ≠ `host.example`) |
| `["https://host.example"]` | `https://host.example/` | ❌ `origin_not_allowed` (`new URL(...).origin` stripper path, men hvis origin-feltet indeholder trailing slash i nogle browsere kan det variere — hold dig til ren `protocol://host:port`) |
| `["https://127.0.0.1:3000"]` | `https://localhost:3000` | ❌ `origin_not_allowed` (IP ≠ hostname) |

> **Prioritet:** Origin-check kører **før** schema-validering. En besked fra forkert origin afvises med `origin_not_allowed` uanset payload — host lækker aldrig detaljer om schema-fejl til en uautoriseret afsender.

## Kontrakt-eksempler

### Gyldig `host:hello`

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "host:hello",
  "ts": 1717584000000
}
```

Embed svarer med:
```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:ready",
  "payload": { "rehello": true },
  "ts": 1717584000001
}
```

### Gyldig `host:update_spec`

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "host:update_spec",
  "payload": { "brief": "Omskrevet krav...", "family": "BPMN" },
  "ts": 1717584000002
}
```

### Afvist: forkert contract-version

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v2",
  "canvas_id": "aurora-canvas-abc123",
  "type": "host:hello",
  "ts": 1717584000000
}
```

→ `canvas:error { code: "wrong_contract_version", detail: { received_contract: "widgetdc.bridge.v2" } }`

### Afvist: canvas_id mismatch

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-ROGUE",
  "type": "host:hello",
  "ts": 1717584000000
}
```

→ `canvas:error { code: "canvas_id_mismatch", detail: { received_canvas_id: "aurora-canvas-ROGUE" } }`

### Afvist: ugyldigt schema

```json
null
```
eller
```json
42
```
eller
```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "rogue:type",
  "ts": 1717584000000
}
```

→ `canvas:error { code: "invalid_schema", detail: { issues: [...] } }`

## Komplette `canvas:error` payload-eksempler (copy-paste)

Nedenstående er fulde JSON-beskeder embed sender tilbage til host — klar til at copy-pastes ind i test eller debug-konsol.

### `origin_not_allowed`

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:error",
  "payload": {
    "code": "origin_not_allowed",
    "message": "Besked fra origin \"https://attacker.example\" afvist \u2014 ikke p\u00e5 allow-list.",
    "detail": {
      "received_origin": "https://attacker.example",
      "allowed_origins": ["https://host.example"]
    }
  },
  "ts": 1717584000005
}
```

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:error",
  "payload": {
    "code": "origin_not_allowed",
    "message": "Besked fra origin \"null\" afvist \u2014 ikke p\u00e5 allow-list.",
    "detail": {
      "received_origin": null,
      "allowed_origins": ["https://host.example"]
    }
  },
  "ts": 1717584000006
}
```

### `wrong_contract_version`

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:error",
  "payload": {
    "code": "wrong_contract_version",
    "message": "Bridge contract-version \"widgetdc.bridge.v2\" underst\u00f8ttes ikke. Forventet \"widgetdc.bridge.v1\".",
    "detail": {
      "received_contract": "widgetdc.bridge.v2",
      "expected_contract": "widgetdc.bridge.v1"
    }
  },
  "ts": 1717584000007
}
```

### `invalid_schema` (manglende felt)

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:error",
  "payload": {
    "code": "invalid_schema",
    "message": "Bridge-payload matcher ikke widgetdc.bridge.v1-schemaet (1 fejl): <root>: Required",
    "detail": {
      "issues": ["<root>: Required"]
    }
  },
  "ts": 1717584000008
}
```

### `invalid_schema` (ukendt type)

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:error",
  "payload": {
    "code": "invalid_schema",
    "message": "Bridge-payload matcher ikke widgetdc.bridge.v1-schemaet (1 fejl): type: Invalid enum value. Expected 'host:hello' | 'host:update_spec' | 'host:set_viewport' | 'canvas:ready' | 'canvas:error' | 'canvas:select_node' | 'canvas:viewport_changed', received 'rogue:type'",
    "detail": {
      "issues": ["type: Invalid enum value. Expected 'host:hello' | 'host:update_spec' | 'host:set_viewport' | 'canvas:ready' | 'canvas:error' | 'canvas:select_node' | 'canvas:viewport_changed', received 'rogue:type'"]
    }
  },
  "ts": 1717584000009
}
```

### `canvas_id_mismatch`

```json
{
  "v": 1,
  "contract": "widgetdc.bridge.v1",
  "canvas_id": "aurora-canvas-abc123",
  "type": "canvas:error",
  "payload": {
    "code": "canvas_id_mismatch",
    "message": "canvas_id \"aurora-canvas-ROGUE\" matcher ikke embed'ets canvas_id \"aurora-canvas-abc123\".",
    "detail": {
      "received_canvas_id": "aurora-canvas-ROGUE",
      "expected_canvas_id": "aurora-canvas-abc123"
    }
  },
  "ts": 1717584000010
}
```

### Prioritetsrækkefølge i praksis

Når en besked fejler på **flere** regler samtidig, bestemmer prioritetsrækkefølgen hvilken fejl host modtager:

1. **Origin-check** kører først → `origin_not_allowed` (ingen schema-leak til uautoriseret afsender)
2. **Contract-version** → `wrong_contract_version`
3. **Schema-validering** → `invalid_schema`
4. **Canvas ID match** → `canvas_id_mismatch`

Eksempel: en besked fra `https://attacker.example` med `contract: "widgetdc.bridge.v2"` og `canvas_id: "ROGUE"` → host modtager **kun** `origin_not_allowed`.

## Aktivering i embed

`useCanvasBridge` tager en valgfri `allowedOrigins`:

```tsx
useCanvasBridge(payload, {
  allowedOrigins: ["https://host.example", "https://app.widgetdc.io"]
});
```

Hvis udeladt: ingen origin-check (legacy/dev-tilstand).

## Endpoints

| Endpoint | Formål |
|----------|--------|
| `POST /api/mrp/canvas/resolve` | Host kalder for at få `embed_url` + signeret token |
| `GET /embed/canvas/:canvasId?t=<token>` | iframe target — verificerer token, rehydrerer spec |

## Fejlkoder

| Kode | Årsag | Handlingsanvisning |
|------|-------|-------------------|
| `origin_not_allowed` | Afsender-origin ikke på allow-list | Verificér `allowedOrigins` konfiguration |
| `wrong_contract_version` | `contract` felt ≠ `"widgetdc.bridge.v1"` | Opgrader host til nyeste kontrakt-version |
| `invalid_schema` | Payload fejler Zod-validering | Check at alle påkrævede felter er tilstede og har korrekte typer |
| `canvas_id_mismatch` | `canvas_id` i besked ≠ embed'ets ID | Sikr at host sender til den korrekte iframe |
