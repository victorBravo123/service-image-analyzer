# Analizador Inteligente de Contenido de Imágenes

Aplicación web full-stack que permite subir una imagen, la analiza mediante un
servicio de IA y muestra las etiquetas detectadas con su nivel de confianza.

**Flujo:** el usuario elige una imagen (con vista previa y validación inmediata)
→ el backend verifica que el archivo sea realmente una imagen inspeccionando sus
*magic bytes* → la envía al proveedor de IA → devuelve las etiquetas ordenadas
por confianza → la interfaz las muestra con barras de confianza.

---

## Tecnologías

| Capa | Stack |
|---|---|
| Backend | Node.js 22 · TypeScript 5 · Express 4 · Zod · Pino — **arquitectura hexagonal** |
| Frontend | React 18 · Vite 6 · TypeScript 5 |
| IA | [Imagga](https://imagga.com/) — adaptador intercambiable, con modo demo sin credenciales |
| Testing | Jest + Supertest (backend) · Vitest + Testing Library (frontend) — **57 tests** |
| Infraestructura | Docker multi-stage · docker-compose · nginx |

---

## Ejecución rápida con Docker (recomendada)

Único requisito: Docker. **No necesita API key** — por defecto usa un anotador de
demostración determinista.

```bash
docker compose up --build
```

Abre **http://localhost:8080** y listo.

Para usar la IA real, crea un archivo `.env` en la raíz del proyecto:

```env
ANNOTATOR=imagga
IMAGGA_API_KEY=tu_api_key
IMAGGA_API_SECRET=tu_api_secret
```

y vuelve a ejecutar `docker compose up --build`.

---

## Ejecución local (sin Docker)

Requiere Node.js ≥ 20.

### Backend — puerto 3000

```bash
cd backend
npm install
cp .env.example .env        # en Windows: copy .env.example .env
npm run dev
```

### Frontend — puerto 5173 (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. El servidor de desarrollo de Vite hace proxy de
`/api` hacia el backend, así que no hay que configurar CORS ni URLs.

---

## Variables de entorno

Se configuran en `backend/.env` (copiar desde `backend/.env.example`).

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del API | `3000` |
| `MAX_IMAGE_MB` | Tamaño máximo de imagen aceptado | `5` |
| `ANNOTATOR` | Proveedor de IA: `imagga` o `fake` (demo sin credenciales) | `fake` |
| `IMAGGA_API_KEY` | API key de Imagga — **obligatoria** si `ANNOTATOR=imagga` | — |
| `IMAGGA_API_SECRET` | API secret de Imagga — **obligatoria** si `ANNOTATOR=imagga` | — |
| `IMAGGA_TIMEOUT_MS` | Timeout de la llamada al proveedor | `30000` |

Las credenciales gratuitas se obtienen en <https://imagga.com/auth/signup>
(plan free, sin tarjeta).

Dos decisiones deliberadas sobre configuración:

- **La configuración se valida al arrancar.** Si seleccionas `ANNOTATOR=imagga`
  sin credenciales, el proceso se niega a iniciar con un mensaje explícito, en
  lugar de fallar más tarde en la primera petición.
- **El timeout por defecto es de 30 s** porque Imagga abandona el procesamiento
  alrededor de los 15 s en su plan gratuito; un plazo más corto ocultaría su
  mensaje de error real detrás de un timeout ciego nuestro.

---

## API

### `POST /api/analyze`

Recibe `multipart/form-data` con el archivo en el campo **`image`**
(JPG, PNG, WebP o GIF, máximo 5 MB).

```bash
curl -X POST http://localhost:3000/api/analyze -F "image=@foto.jpg"
```

```json
{
  "tags": [
    { "label": "dog", "confidence": 0.98 },
    { "label": "park", "confidence": 0.91 }
  ]
}
```

Las etiquetas siempre vienen ordenadas por confianza descendente.

### Errores

Todos comparten la misma forma: `{ "error": { "code", "message" } }`.

| HTTP | `code` | Caso |
|---|---|---|
| 400 | `IMAGE_REQUIRED` | No se envió ningún archivo |
| 400 | `INVALID_UPLOAD` | Campo incorrecto o más de un archivo |
| 413 | `IMAGE_TOO_LARGE` | El archivo supera `MAX_IMAGE_MB` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | El contenido no es una imagen (se inspeccionan los *magic bytes*, no la extensión) |
| 502 | `ANALYSIS_FAILED` | El proveedor de IA falló o no respondió a tiempo |
| 503 | `SERVICE_UNAVAILABLE` | Rate limit del proveedor |
| 500 | `INTERNAL_ERROR` | Error inesperado (respuesta opaca a propósito) |

### `GET /api/health`

Healthcheck: `{ "status": "ok" }`.

---

## Tests

```bash
cd backend  && npm test    # 48 tests: unitarios + integración con supertest
cd frontend && npm test    #  9 tests: componentes con Testing Library
```

Otros scripts disponibles en ambos proyectos: `npm run lint`, `npm run build` y,
en el backend, `npm run typecheck`.

---

## Arquitectura

El backend sigue **arquitectura hexagonal** (ports & adapters). La regla de
dependencia apunta siempre hacia adentro: `infrastructure → application → domain`.

```
     HTTP (Express, multer)                    Imagga API
            │ driving                              ▲ driven
            ▼                                      │
┌──────────────────────────────────────────────────────────┐
│  infrastructure     http/ · providers/ · config/         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  application     AnalyzeImageUseCase               │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  domain    Tag · ImageAnalysis               │  │  │
│  │  │            puerto ImageAnnotator             │  │  │
│  │  │            detectImageFormat (magic bytes)   │  │  │
│  │  │            errores tipados                   │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

La pieza clave es el puerto **`ImageAnnotator`**: Imagga es solo un adaptador
(`ImaggaAnnotator`), igual que el modo demo (`FakeAnnotator`). Cambiar de
proveedor de IA — Google Vision, OpenAI — significa escribir otro adaptador y
seleccionarlo en el *composition root*; el dominio, el caso de uso y la capa HTTP
no se tocan.

El frontend replica la misma separación en versión ligera:
`domain / application / infrastructure / ui`.

Las decisiones técnicas y sus alternativas están explicadas en
[`docs/architecture.md`](docs/architecture.md). El uso de IA durante el
desarrollo se documenta en [`docs/AI_USAGE.md`](docs/AI_USAGE.md).

---

## Decisiones destacadas

**Seguridad del upload**
- Validación por *magic bytes* en el servidor: nunca se confía en el mime type
  que declara el cliente, así que un `.txt` renombrado a `.jpg` se rechaza.
- Límite de tamaño aplicado en el borde (multer) antes de leer el archivo entero.
- La imagen se procesa **solo en memoria**; nunca se escribe a disco.
- Las API keys se leen exclusivamente de variables de entorno, y `.env` está en
  `.gitignore` desde el primer commit del repositorio.

**Manejo de errores**
- Errores de dominio tipados, traducidos a códigos HTTP estables en un único
  punto (`error-handler.ts`).
- Los errores inesperados devuelven un 500 opaco para no filtrar detalles
  internos al cliente.
- El frontend consume los `code`, no los mensajes, y muestra texto accionable en
  español en lugar de números de estado.

**Modo demo**
- `ANNOTATOR=fake` permite evaluar la aplicación completa sin registrar ninguna
  cuenta externa, y es también lo que hace determinista la suite de tests.

---

## Flujo de trabajo con Git

El desarrollo siguió un flujo de promoción por entornos:

```
feature/* ──▶ dev ──▶ qa ──▶ main
```

Cada funcionalidad se desarrolló en su propia rama y se integró a `dev` mediante
Pull Request, con commits atómicos que explican el *qué* y el *porqué* de cada
cambio.
