# Arquitectura y decisiones técnicas

## Visión general

```
┌──────────────┐   multipart   ┌──────────────────────────┐   multipart   ┌────────────┐
│   Frontend   │ ────────────▶ │       Backend API        │ ────────────▶ │   Imagga   │
│  React+Vite  │               │  Express · hexagonal     │               │  (o fake)  │
│              │ ◀──────────── │                          │ ◀──────────── │            │
└──────────────┘   tags JSON   └──────────────────────────┘  tags 0-100   └────────────┘
```

En desarrollo, el dev-server de Vite hace proxy de `/api` al backend; en Docker
ese papel lo cumple nginx. En ambos casos el navegador ve **un solo origen**, así
que no existe configuración de CORS que mantener ni que diverja entre entornos.

---

## Backend: hexagonal (ports & adapters)

Regla de dependencia: `infrastructure → application → domain`. Ningún archivo del
dominio importa Express, `fetch` ni ninguna librería externa.

| Capa | Contenido | Regla |
|---|---|---|
| `domain` | `Tag`, `ImageAnalysis`, `AnnotatorCredentials`, `detectImageFormat`, puertos `ImageAnnotator`, `CredentialsProvider`, `CircuitBreakerStore` y `Logger`, errores tipados | Cero dependencias externas; las invariantes viven en los constructores |
| `application` | `AnalyzeImageUseCase` | Orquesta: valida formato → llama al puerto → ordena el resultado |
| `infrastructure` | `http/` (rutas, multer, error handler, logging de peticiones), `providers/` (Imagga, fake, factory), `resilience/` (circuit breaker y su store en Redis), `config/` (env con Zod, secretos y logger) | Adaptadores que implementan o consumen los puertos |
| `main.ts` | Composition root | Único archivo que conoce todos los adaptadores concretos |

### Por qué así

**El puerto `ImageAnnotator` es el corazón del diseño.** El requisito "integrar
un servicio de IA de terceros" es exactamente el caso de uso canónico de un
puerto: la dependencia más volátil y menos confiable del sistema queda detrás de
una interfaz que define el dominio. `ImaggaAnnotator` y `FakeAnnotator` son
adaptadores equivalentes; añadir Google Vision u OpenAI sería un archivo nuevo
más una línea en el factory.

Esto dejó de ser teórico durante el desarrollo: cuando el servicio de Imagga
empezó a agotar su tiempo de procesamiento del lado de ellos, la aplicación no
se cayó — el adaptador tradujo el fallo a `AnalysisFailedError`, el error handler
lo mapeó a `502`, el frontend mostró un mensaje comprensible, y se pudo seguir
desarrollando con `ANNOTATOR=fake`.

**El circuit breaker es un decorador, no una modificación.** `CircuitBreakerAnnotator`
implementa `ImageAnnotator` y envuelve al adaptador real. Ni el caso de uso ni
`ImaggaAnnotator` cambian una línea, y la protección sigue en pie el día que el
proveedor sea otro. Probarlo no exige simular HTTP: basta un anotador que falle.

Tres decisiones dentro del breaker:

- **Abre a los tres fallos consecutivos** y responde `503` en milisegundos, en
  vez de retener la conexión hasta el timeout del proveedor. Ese es el beneficio
  real: liberar recursos, no devolver un error más bonito.
- **No todo fallo cuenta.** Solo los que se arreglan esperando. Un timeout o un
  `5xx` sí; una imagen inválida no —el usuario no debe poder abrir el circuito
  para los demás— y unas credenciales rechazadas tampoco, porque esperar no
  arregla una API key mal puesta y abrir el circuito escondería la causa.
- **El estado vive en Redis** y lo comparten todas las instancias. Solo se usan
  comandos atómicos: `INCR` para el contador y una clave con TTL cuya sola
  existencia significa "abierto". Así Redis mide el tiempo y no hay relojes de
  distintos contenedores que puedan discrepar.

**El logger también es un puerto.** `Logger` vive en `domain/ports/` y `PinoLogger`
es su único adaptador. La capa HTTP recibe el puerto, no un tipo de pino, así que
cambiar de librería no la toca. Cada petición lleva un `IdTransaction` que
correlaciona `start-request`, `end-request` y el `error` si lo hay. El cuerpo no
se registra nunca: aquí es una imagen binaria.

**La validación por magic bytes vive en el dominio.** Decidir "¿esto es una
imagen?" es una regla de negocio, no un detalle de HTTP. Además, hacerlo antes de
llamar al proveedor evita gastar cuota (y dinero) en archivos inválidos.

**Errores tipados con un único punto de traducción.** El dominio lanza errores
con un `code` estable; `error-handler.ts` es el único lugar que los convierte en
respuestas HTTP. El frontend depende de esos códigos, no de los mensajes, lo que
permite cambiar la redacción sin romper el cliente.

**Express en lugar de NestJS.** Con un solo endpoint, un framework con inyección
de dependencias propia ocultaría justamente lo que se quiere mostrar: aquí la
arquitectura se compone a mano en `main.ts` y las dependencias se inyectan por
constructor, lo que además hace trivial el testing con dobles.

**`fetch` nativo con `AbortSignal.timeout`.** Node ≥ 18 no necesita un cliente
HTTP de terceros: una dependencia menos que auditar y actualizar.

**Nada de endpoints ni credenciales en el código.** El endpoint del proveedor se
inyecta desde `IMAGGA_BASE_URL`, de modo que apuntar a un sandbox o a un mock en
un entorno de pruebas es cambiar una variable, no recompilar. El adaptador ya no
conoce ninguna URL por defecto: la recibe siempre por constructor, y un test lo
verifica precisamente para que nadie vuelva a fijarla en el código.

**El origen de las credenciales también es un puerto.** `CredentialsProvider`
vive en `domain/ports/`, como todo puerto, y se define en lenguaje neutro:
devuelve `AnnotatorCredentials`, sin nombrar a ningún proveedor. Sus dos
adaptadores están en infraestructura — `EnvSecretsProvider`, que lee las
variables de entorno mientras se desarrolla en local, y
`AwsSecretsManagerProvider`, que resuelve el secreto en AWS Secrets Manager en
cualquier entorno desplegado. La decisión la toma `APP_ENV`, no el código.

Lo que **no** cruza hacia el dominio es lo específico de cada adaptador: la
configuración de AWS (`AwsSecretsManagerConfig`), los nombres de variables de
entorno (`EnvCredentialsSource`) y el esquema Zod que valida el payload del
secreto. Llevarlos al núcleo obligaría al dominio a conocer AWS y a depender de
Zod, que es justo el acoplamiento que la arquitectura hexagonal evita.

**Los tipos viven en archivos propios**, no declarados dentro de las clases que
los usan: `dto/` para las formas de datos que cruzan una frontera y `ports/`
para los contratos. Así un contrato se lee sin abrir la implementación, y
cambiarlo no obliga a tocar la clase.

Tres detalles que importan en producción:

- El secreto se **valida** con el mismo rigor que la configuración (Zod), en vez
  de confiar en que tenga la forma esperada; si le falta una clave, el proceso
  no arranca.
- Se lee **una sola vez** y se cachea durante la vida del proceso: pedirlo en
  cada petición añadiría latencia y coste sin ganar nada.
- Los errores de AWS se envuelven citando **qué secreto** falló y por qué
  (`AccessDeniedException`, por ejemplo), que es la información que hace falta a
  las 3 de la mañana.

**Las credenciales se resuelven antes de escuchar peticiones.** El arranque es
asíncrono a propósito: si el secreto no existe o el rol no tiene permisos, el
proceso muere en el boot y el orquestador lo reporta, en lugar de aceptar
tráfico que fallaría en cada subida.

**Timeout de 30 s hacia el proveedor.** Medido contra la API real: Imagga
abandona alrededor de los 15 s en el plan gratuito. Un timeout más corto del lado
del cliente enmascararía el mensaje de error del proveedor detrás de uno propio,
menos informativo para diagnosticar.

### Flujo de una petición

```
POST /api/analyze
  → multer (memoria, límite MAX_IMAGE_MB)      [infrastructure/http]  → 413 si excede
  → AnalyzeImageUseCase.execute({ content })    [application]
      → detectImageFormat(content)              [domain]              → 415 si no es imagen
      → annotator.annotate({ content, format }) [puerto]              → 502 / 503 si falla
      → ImageAnalysis.fromTags(tags)            [domain]              ordena por confianza
  → 200 { tags: [{ label, confidence }] }
```

---

## Frontend: la misma idea, en versión ligera

| Capa | Contenido |
|---|---|
| `domain` | Tipos del contrato del API y validación de archivo (tipo y tamaño) |
| `application` | `useImageSelection` (archivo + ciclo de vida del object URL) y `useImageAnalysis` (máquina de estados `idle`/`loading`/`success`/`error`) |
| `infrastructure` | `analyze-client.ts`: único punto que conoce `fetch` y los códigos de error del API |
| `ui` | Componentes presentacionales: dropzone, spinner, lista de tags, banner de error |

La validación en el cliente existe solo para dar feedback inmediato; la frontera
de seguridad real es siempre el backend, que revalida por contenido.

Detalle de implementación: `useImageSelection` revoca el object URL en cada
cambio y al desmontar, para que subir varias imágenes seguidas no acumule
memoria.

---

## Testing

**117 tests** distribuidos según el valor que aportan, no para alcanzar un
porcentaje:

- **Dominio y aplicación (unitarios):** invariantes de `Tag`, ordenamiento de
  `ImageAnalysis`, detección de formatos — incluyendo un contenedor RIFF que es
  audio WAV y no WebP, y un `.txt` renombrado — y el caso de uso contra un doble
  del puerto.
- **Adaptadores (unitarios):** `ImaggaAnnotator` con `fetch` espiado: mapeo de
  etiquetas, normalización de confianza, autenticación Basic, `429 → 503`,
  `401 → 502`, timeout y fallo de red.
- **Integración (supertest):** la app real con el anotador inyectado, cubriendo
  el contrato completo de errores HTTP.
- **Configuración y secretos (unitarios):** las reglas de arranque por entorno
  (qué exige `APP_ENV=local` frente a un entorno desplegado) y ambos adaptadores
  de `SecretsProvider`, incluyendo secreto inexistente, JSON inválido, forma
  incorrecta, error de AWS y que la lectura se cachea.
- **Observabilidad (unitarios):** el adaptador de pino (que reenvía todos los
  campos y sella `datetime`), el middleware de request (un `IdTransaction` por
  petición, `responseTime` medido, healthchecks excluidos) y el logging de
  errores (5xx a `error`, 4xx a `warn`, correlacionado con su `start-request`).
- **Resiliencia (unitarios + integración):** la máquina de estados del circuit
  breaker con un doble del store, y el adaptador de Redis contra un Redis real
  para lo que un doble no puede probar — que `INCR` mantiene el contador exacto
  con 50 fallos concurrentes y que el estado se comparte entre instancias. Estos
  últimos se saltan sin `REDIS_TEST_URL`.
- **Frontend (Testing Library):** el flujo tal como lo vive el usuario — botón
  deshabilitado hasta seleccionar, spinner durante la petición, tags renderizados
  con su porcentaje, fallo del proveedor, backend inalcanzable y resultado vacío.

---

## Qué haría con más tiempo

- **Rate limiting propio** en el API (`express-rate-limit`), además del que
  impone el proveedor.
- **Reintentos con backoff exponencial** ante errores 5xx transitorios de Imagga,
  con un límite de intentos para no amplificar una caída.
- **Caché por hash del contenido**: la misma imagen no debería consumir cuota dos
  veces.
- **Tests end-to-end con Playwright** sobre el stack de docker-compose, para
  cubrir el recorrido real en un navegador.
- **Observabilidad**: métricas de latencia y tasa de error por proveedor, que es
  lo que permitiría decidir con datos cuándo cambiar de proveedor.
