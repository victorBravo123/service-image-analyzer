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
| Backend | Node.js 22 · TypeScript 5 · Express 4 · Zod · Pino · ioredis — **arquitectura hexagonal** |
| Frontend | React 18 · Vite 6 · TypeScript 5 |
| IA | [Imagga](https://imagga.com/) — adaptador intercambiable, con modo demo sin credenciales |
| Secretos | AWS Secrets Manager fuera de desarrollo local |
| Testing | Jest + Supertest (backend) · Vitest + Testing Library (frontend) — **117 tests** |
| Resiliencia | Circuit breaker con estado compartido en Redis |
| Infraestructura | Docker multi-stage · docker-compose · nginx · Redis |

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
APP_ENV=local
ANNOTATOR=imagga
IMAGGA_API_KEY=tu_api_key
IMAGGA_API_SECRET=tu_api_secret
```

y vuelve a ejecutar `docker compose up --build`. El stack ya incluye un Redis
para el circuit breaker, así que no hay que levantar nada más.

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

Arranca en modo demo (`ANNOTATOR=fake`) sin necesitar nada más.

**Para usar la IA real** hacen falta credenciales de Imagga y un Redis, donde el
circuit breaker guarda su estado:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

y en `backend/.env`:

```env
ANNOTATOR=imagga
IMAGGA_API_KEY=tu_api_key
IMAGGA_API_SECRET=tu_api_secret
REDIS_URL=redis://127.0.0.1:6379
```

En Windows usa `127.0.0.1` y no `localhost`: este último resuelve a IPv6 y
Docker publica el puerto en IPv4.

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
| `APP_ENV` | Entorno de ejecución: `local`, `dev`, `qa`, `staging`, `prod`. Determina de dónde salen las credenciales | `local` |
| `PORT` | Puerto del API | `3000` |
| `MAX_IMAGE_MB` | Tamaño máximo de imagen aceptado | `5` |
| `ANNOTATOR` | Proveedor de IA: `imagga` o `fake` (demo sin credenciales) | `fake` |
| `IMAGGA_BASE_URL` | Endpoint del proveedor | `https://api.imagga.com/v2` |
| `IMAGGA_TIMEOUT_MS` | Timeout de la llamada al proveedor | `30000` |
| `IMAGGA_API_KEY` | API key — **solo si `APP_ENV=local`** | — |
| `IMAGGA_API_SECRET` | API secret — **solo si `APP_ENV=local`** | — |
| `IMAGGA_SECRET_ID` | Nombre o ARN del secreto en AWS Secrets Manager — **si `APP_ENV` no es `local`** | — |
| `AWS_REGION` | Región de AWS. Opcional: el SDK la resuelve del entorno de ejecución | — |
| `REDIS_URL` | Redis del circuit breaker. **Obligatorio si `ANNOTATOR=imagga`**. `rediss://` para TLS | — |
| `REDIS_USERNAME` | Usuario de Redis, si el servidor lo exige (ACL) | — |
| `REDIS_PASSWORD` | Contraseña de Redis | — |
| `CB_FAILURE_THRESHOLD` | Fallos consecutivos que abren el circuito | `3` |
| `CB_OPEN_MS` | Tiempo que permanece abierto antes de reintentar | `60000` |
| `LOG_LEVEL` | Nivel de log (`fatal`…`trace`, `silent`) | `info` |

Las credenciales gratuitas se obtienen en <https://imagga.com/auth/signup>
(plan free, sin tarjeta).

### De dónde salen las credenciales

El origen depende de `APP_ENV`, no del código:

- **`APP_ENV=local`** → se leen de las variables de entorno (`backend/.env`, que
  nunca se commitea). Es lo cómodo para desarrollar.
- **Cualquier otro valor** → se resuelven desde **AWS Secrets Manager**, leyendo
  el secreto que indica `IMAGGA_SECRET_ID`. Así ningún credencial viaja en la
  imagen de Docker, en el repositorio ni en una variable de entorno del
  despliegue.

El secreto debe contener un JSON con esta forma exacta:

```json
{
  "IMAGGA_API_KEY": "acc_xxxxxxxxxxxxxxx",
  "IMAGGA_API_SECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

Se valida al leerlo: si falta alguna clave, el proceso no arranca. En AWS, el
rol de ejecución necesita permiso `secretsmanager:GetSecretValue` sobre ese
secreto.

Tres decisiones deliberadas sobre configuración:

- **La configuración se valida al arrancar.** Si seleccionas `ANNOTATOR=imagga`
  sin lo necesario para el `APP_ENV` en curso, el proceso se niega a iniciar con
  un mensaje explícito, en lugar de fallar más tarde en la primera petición.
- **Las credenciales se resuelven antes de escuchar peticiones**, así un
  despliegue mal configurado falla en el arranque y no atiende tráfico roto.
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
cd backend  && npm test    # 102 tests unitarios y de integración
cd frontend && npm test    #   9 tests de componentes con Testing Library
```

Otros 6 tests comprueban el store del circuit breaker contra un Redis real —lo
que un doble no puede probar, como que `INCR` mantiene el contador exacto con
50 fallos concurrentes—. Se saltan solos si no hay Redis:

```bash
docker run --rm -d -p 6399:6379 --name cb-redis redis:7-alpine
REDIS_TEST_URL=redis://127.0.0.1:6399 npm test    # 108 tests
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
│  infrastructure     http/ · providers/ · config/secrets/ │
│  ┌────────────────────────────────────────────────────┐  │
│  │  application     AnalyzeImageUseCase               │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  domain    Tag · ImageAnalysis               │  │  │
│  │  │            puertos ImageAnnotator            │  │  │
│  │  │                  y CredentialsProvider       │  │  │
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

El mismo principio se aplica al origen de las credenciales: `CredentialsProvider`
es otro puerto del dominio, con dos adaptadores en infraestructura —
`EnvSecretsProvider` para desarrollo local y `AwsSecretsManagerProvider` para
entornos desplegados. Añadir otro gestor de secretos — Vault, Parameter Store —
sería un adaptador más, sin tocar el resto.

El frontend replica la misma separación en versión ligera:
`domain / application / infrastructure / ui`.

Las decisiones técnicas y sus alternativas están explicadas en
[`docs/architecture.md`](docs/architecture.md).

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

**Resiliencia ante el proveedor de IA**
- Circuit breaker como **decorador** del puerto `ImageAnnotator`: ni el caso de
  uso ni `ImaggaAnnotator` saben que existe.
- Tres fallos consecutivos abren el circuito. Estando abierto responde `503` en
  milisegundos, sin retener la conexión hasta el timeout del proveedor.
- Un éxito cierra el circuito y borra el contador; si nadie vuelve a intentarlo,
  la clave de Redis expira sola pasado `CB_OPEN_MS`.
- Solo `ANALYSIS_FAILED` y `SERVICE_UNAVAILABLE` cuentan. Una imagen inválida no
  abre el circuito: si no, un usuario subiendo archivos raros tumbaría el
  servicio para todos.
- El estado vive en Redis y lo comparten todas las instancias. `INCR` es atómico,
  así que el contador no se descuadra con peticiones concurrentes, y la clave
  `:open` lleva TTL: es Redis quien mide el tiempo, no el proceso.
- Unas credenciales rechazadas (`401`/`403`) **no** abren el circuito. Esperar no
  arregla una API key mal puesta; el log lo dice y el operador actúa.
- Si Redis no responde, la petición recibe `503`, no un `500` opaco. Un fallo del
  store *después* de una llamada correcta no invalida esa respuesta.

**Observabilidad**
- El logger vive detrás del puerto `Logger` del dominio; `PinoLogger` es su
  único adaptador, así que cambiar de librería no toca ni la capa HTTP ni el
  caso de uso.
- Cada petición recibe un `IdTransaction` (UUID) y emite tres entradas
  correlacionadas: `start-request`, `end-request` y, si falla, `error`.
- Formato JSON estable — `serviceName`, `version`, `datetime`, `urlService`,
  `action`, `event`, `method`, `responseTime`, `status`, `code`, `message` —
  pensado para indexarse tal cual en un buscador de logs.
- El cuerpo de la petición **nunca** se registra: aquí es una imagen binaria.
  Los healthchecks tampoco, para no ahogar la señal útil.

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
