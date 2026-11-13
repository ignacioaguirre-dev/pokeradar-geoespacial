## Stack

- Next.js 16 con App Router, TypeScript, Tailwind CSS 4 y ESLint.
- Gestor de paquetes: pnpm. No usar npm ni yarn.
- El código de la app vive en `src/`; la raíz es sólo configuración. Alias `@/*` → `src/*`.

## Ramas (Gitflow)

- `main`: producción. Sólo recibe merges de `release/*` y `hotfix/*`, taggeados con la versión (`v1.2.0`).
- `develop`: base de desarrollo.
- `feat/*`, `fix/*`, `chore/*` y `release/*` salen de `develop`; `hotfix/*` sale de `main`. `release/*` y `hotfix/*` se integran en `main` y en `develop`.
- Nombre: `<tipo>/<issue opcional>-<descripcion-en-kebab-case>`, por ejemplo `feat/42-mapa-de-avistamientos`.
- Nunca commitear directo a `main` ni a `develop`; todo entra por PR.
- Merge de los PR:
  - `feat/*`, `fix/*` y `chore/*` → `develop`: squash. El título del PR es el commit.
  - `release/*` y `hotfix/*` → `main` y de vuelta a `develop`: merge commit, nunca squash, para que `main` y `develop` compartan historia.
  - Rebase and merge está desactivado: pierde la firma de los commits.

## Commits y comentarios

- Código e identificadores en inglés; textos de la interfaz en español (es-AR) mediante next-intl (messages/es-AR.json).
- Commits `tipo(alcance): asunto` en castellano, asunto en minúscula. El tipo coincide con el prefijo de la rama.
- Nunca mencionar en commits, PRs ni comentarios quién pidió el cambio ni de qué conversación salió.
- Comentarios en inglés, cortos y sólo el porqué.
- Nunca commitear archivos `.env*`.

## Arquitectura de carpetas

- `src/domain`: lógica pura (cercas, distancias, reglas). Sólo importa de `domain` (entre subcarpetas, con `@/domain/…`; nunca `../`); sin React, Next, `maplibre-gl`, red ni DOM (`fetch`, `window`, `document`...).
- `src/features`: estado, almacenamiento y hooks por funcionalidad (`queries.ts`, `schema.ts`, `storage.ts`, `use-*.ts`); puede importar `domain`.
- `queries.ts` lleva `import "server-only"` y sólo se lee desde `src/app`; ningún componente lo importa.
- `src/data`: datos estáticos; `domain` no lo importa.
- `src/map`: el único lugar que importa `maplibre-gl` (también con `import()` dinámico); sólo conoce `domain` y recibe datos por props, sin importar `features`.
- `src/components`: piezas de interfaz; `components/ui` es presentación pura, sin dominio ni features.
- `src/app`: rutas y composición; lee `queries` del servidor.
- `src/i18n`: configuración de next-intl (`request.ts`, tipos de claves); un solo idioma, sin rutas por idioma. El catálogo vive en `messages/es-AR.json`.
- `src/testing`: utilidades de test (`render` con next-intl); sólo lo importan los tests, nunca la app (lo fuerza `pnpm lint`).
- Dirección de dependencias: `domain ← features ← components ← app`.
- Las fronteras las fuerza `pnpm lint`.
- Tests: `.test.ts` corre en node y `.test.tsx` en jsdom; si un test de `storage.ts` o `use-*.ts` necesita DOM, va como `.test.tsx`.
- Antes de escribir un ayudante o una pieza, buscar si ya existe.

## Test: qué escribir y cuándo

- Un test se justifica por un riesgo concreto. No se testea código provisorio, configuración sin lógica ni lo que ya garantizan los tipos o el lint.
- Lógica pura (`src/domain`) → unitario junto al archivo. Geometría y reglas con casos de borde: polígono de menos de 3 vértices, autointersección, punto sobre el borde, área sobre el tope, cerca vacía.
- Entrada y salida (`src/features`) → unitario con `fetch` simulado: validación de la respuesta externa, mapeo y cada error. Ningún test pega contra PokéAPI, Open-Meteo o USGS reales.
- Componentes → Testing Library por rol y texto visible, nunca por clases o estructura. Cada estado de la spec (cargando, error con reintento, vacío) tiene su caso.
- Flujos completos y lo que depende del navegador (mapa, WebGL, red caída, teclado) → E2E con Playwright. El mapa se afirma por lo observable (marcadores, lista, lectura), nunca por píxeles del lienzo.
- `@critico` sólo en los flujos que tienen que andar en los cinco perfiles; el resto corre en chromium.
- Una regla transversal se protege con un test de conformidad (ejemplo: `tooling/import-boundaries.test.ts`): un caso prohibido y uno permitido por regla, más cada fuga que se haya encontrado.
- Todo fix de bug entra con el test que lo reproduce (en rojo antes, en verde después).
- Un camino de error se testea afirmando lo que ve el usuario (mensaje, reintento), no sólo que algo falló.
- Determinismo: lo aleatorio lleva semilla y lo que depende de la hora usa fechas fijas o fake timers.
- Los tests de captura visual llevan la etiqueta `@visual` y sólo corren en chromium (la config los excluye de los otros perfiles). Las capturas de base viven en `e2e/__screenshots__/` y los ayudantes de E2E en `e2e/helpers.ts`.
- Sin `.only`. Un `.skip` lleva condición y motivo.
