# Arquitectura en detalle

Complementa la sección 2 del [README](README.md).

## Carpetas y fronteras

- `src/domain`: lógica pura (cercas, distancias, reglas). Sólo importa de `domain`; sin React, Next, `maplibre-gl`, red ni DOM.
- `src/features`: estado, almacenamiento y hooks por funcionalidad (`queries.ts`, `schema.ts`, `storage.ts`, `use-*.ts`); puede importar `domain`. `queries.ts` lleva `import "server-only"` y sólo se lee desde `src/app`.
- `src/hooks`: hooks genéricos sin negocio.
- `src/data`: datos estáticos (hábitats, sitios curados, cercas predefinidas); `domain` no lo importa.
- `src/lib`: utilidades de servidor sin negocio (`lib/upstream`: fetch validado, frontera de caché y respuestas de error).
- `src/map`: el único lugar que importa `maplibre-gl`; sólo conoce `domain` y recibe datos por props.
- `src/components`: piezas de interfaz; `components/ui` es presentación pura.
- `src/app`: rutas y composición. Lo que usa una sola ruta va en `src/app/<ruta>/_components/`.
- `src/i18n`: configuración de next-intl. `src/testing`: utilidades de test, que la app nunca importa.

`hooks` es transversal y `lib` es sólo de servidor. Las reglas viven en `eslint.config.mjs` (incluidos los `import()` dinámicos de MapLibre) y `tooling/import-boundaries.test.ts` tiene un caso prohibido y uno permitido por regla, más cada fuga encontrada en revisión.

## Componentes

- **Primitivas** (`src/components/ui`): `Button`, `Notice`, `Tag`, `EnergyBar` y `Quantity`. Reciben todo por props y se ven juntas en `/system`.
- **Piezas con dominio** (`src/components/creature`): `CreatureDetail` muestra carga, error con reintento y datos, y no sabe de dónde vienen.
- **Portada** (`src/app/_components`): `MapStage` (estados, ayuda, vuelo), `HabitatMap` (agrega los hábitats a `BaseMap` de `src/map`), `CreatureRoute` (lee `?creature=`) y `DetailPanel` (pide el detalle con `useCreature`).
- **La URL es el estado del panel.** Abrir una criatura suma una entrada al historial, «atrás» la cierra y un link compartido la abre. Si se abrió desde un link, cerrar sólo quita el parámetro para no sacar al usuario de la app.

## Servidor y cliente

- **Servidor.** El catálogo de 386 especies se arma con 27 llamadas a PokéAPI (9 hábitats y 18 tipos) y se cachea por días. Los avistamientos se calculan a partir del catálogo y se cachean igual. Los errores viajan como valor (`Loaded<T>`), no como excepción: un PokéAPI caído deja la capa vacía y el mapa sigue andando.
- **Endpoint de detalle.** `/api/creatures/[id]` valida el id, pide la criatura y su especie y devuelve sólo lo que la pantalla usa. No reenvía nada del pedido, así que no es un proxy abierto.
- **Cliente.** El mapa y MapLibre viven en un chunk diferido (`next/dynamic` con `ssr: false`), igual que el panel de detalle y `motion`. `e2e/bundle.spec.ts` verifica en CI que el JS inicial no crezca más de 10 KB sobre la base y que MapLibre no aparezca en él.

## Mapa

- Estilo propio sobre OpenFreeMap (`src/map/style.ts`): filtro geométrico con el contorno de Argentina para los rótulos, capa propia para Malvinas, cielo oscuro y un borde del globo dibujado con un color del sistema (`src/map/globe-rim.ts`).
- Gestos de touchpad propios (`src/map/wheel-gesture.ts`): dos dedos mueven el mapa, el pellizco y la rueda del mouse hacen zoom. La clasificación es una función pura con tests.
- Un tile que falla no rompe el mapa; sólo una falla del estilo o de la fuente antes de la carga muestra el error con reintento.

## Datos

- **Hábitats.** `pnpm habitats:build` (`tooling/habitats/build.ts`) baja RESOLVE, recorta a Argentina, une las ecorregiones por hábitat y simplifica con mapshaper. La app sólo lee el GeoJSON resultante (`src/data/habitats.geojson`). El mar usa un polígono propio del Mar Argentino; ciudad, cueva y raro, sitios curados a mano.
- **Reparto determinista.** Cada especie se ubica con un generador con semilla (su id): las mismas criaturas en los mismos lugares para todos, unos 1.700 puntos.
- **Detección por cerca** (`src/domain/sightings/detect.ts`): hasta 12 criaturas trazadas por cerca; el resto, señales débiles.

## Calidad

- **CI en cada PR:** lint, tipos, unitarios con umbral de cobertura, build, E2E y `pnpm audit`.
- **E2E en cinco perfiles** (Chrome, Firefox y Safari de escritorio, Android e iPhone): chromium corre todo y los demás los flujos `@critical`; las ramas de release corren la suite completa en todos. Ningún test pega contra los servicios reales: PokéAPI y OpenFreeMap se reemplazan por fixtures.
- **Accesibilidad:** axe con las reglas de WCAG 2.2 AA sobre la portada, el mapa cargado, la ayuda de controles (escritorio y celular), el detalle y `/system`; E2E de orden y anillo de foco con teclado. `tooling/tokens.test.ts` exige el contraste mínimo de cada par de colores según su uso y falla si algún archivo de `src` usa un color fuera de los tokens.
- **Rendimiento:** presupuesto de JS inicial y un E2E que falla si el desplazamiento de layout (CLS) durante la carga del mapa pasa de 0,01.
- **Capturas visuales** con base en Linux, regenerada en Docker.
- **Seguridad:** CSP, `nosniff`, `Referrer-Policy` y `Permissions-Policy` (`next.config.ts`), verificadas en `e2e/security.spec.ts`.

## Flujo de trabajo

Gitflow: `main` para producción, `develop` como base y una rama `feat/*`, `fix/*` o `chore/*` por unidad, con PR a `develop` y squash. Cada PR completa una definición de terminado (UX, a11y, responsive, resiliencia, rendimiento, seguridad…) con evidencia. Una política de CI rechaza ramas y títulos que no sigan la convención. Commits firmados, en castellano, `tipo(alcance): asunto`.
