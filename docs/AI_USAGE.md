# Uso de IA en el desarrollo

La prueba pedía explícitamente apoyarse en herramientas de IA. Este documento
transparenta cómo se usaron y, sobre todo, dónde termina la asistencia y empieza
el criterio propio.

## Herramienta

Claude Code (Anthropic) como asistente de desarrollo en terminal, durante todo el
ciclo: planificación, implementación, testing y documentación.

## Qué delegué a la IA

- **Scaffolding y configuración**: `tsconfig`, ESLint, Prettier, Jest, Vitest,
  Dockerfiles. Trabajo mecánico y bien documentado, donde escribir a mano solo
  añade oportunidades de error.
- **Boilerplate de implementación**: primeras versiones de componentes, mappers y
  adaptadores, siguiendo la arquitectura que ya había definido.
- **Cobertura de tests**: enumerar casos límite es donde la IA aporta más — de
  ahí salieron pruebas que no habría escrito de entrada, como el contenedor RIFF
  que resulta ser audio WAV en vez de WebP.
- **Redacción de documentación** y mensajes de commit.

## Qué decidí y validé yo

- **La arquitectura**: hexagonal con el proveedor de IA detrás de un puerto del
  dominio, y Express en lugar de NestJS para que la composición quede explícita.
- **La elección del proveedor**: Imagga, por su plan gratuito sin tarjeta y
  porque su respuesta mapea directamente al contrato pedido.
- **La política de errores y de seguridad**: qué código HTTP corresponde a cada
  fallo, validar por magic bytes en lugar de confiar en el mime type, procesar la
  imagen solo en memoria y leer credenciales exclusivamente del entorno.
- **La verificación**: cada rama se validó ejecutando la suite completa (57
  tests), lint, typecheck, build y pruebas manuales del API; el stack de Docker
  se levantó y se probó de punta a punta antes de integrarse.

## Un ejemplo concreto de dónde hizo falta criterio

Al probar la integración real, el backend devolvía siempre `502`. El diagnóstico
descartó primero lo evidente — conectividad correcta, credenciales válidas contra
`/v2/usage` — hasta aislar que el propio Imagga agotaba su tiempo de procesamiento
alrededor de los 15 s, incluso con su imagen de ejemplo. De ahí salieron dos
conclusiones que la IA no iba a tomar sola: que nuestro timeout de 10 s era más
corto que el del proveedor y ocultaba su mensaje de error real (se ajustó a 30 s),
y que el fallo era, en el fondo, la mejor demostración del diseño: la aplicación
degradó de forma controlada en lugar de caerse con el tercero.

## Postura

La IA acelera la ejecución; el diseño, el criterio técnico y la validación siguen
siendo responsabilidad de quien firma el código. Todo commit fue revisado antes
de integrarse, y nada llegó a `dev` sin que la suite de tests y las
verificaciones manuales pasaran.
