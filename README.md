# PokeRadar Geoespacial

Una expedición sobre el mapa de Argentina: las criaturas de PokéAPI aparecen en ecorregiones reales y cada ubicación tiene su porqué.

**App:** <!-- URL de producción -->

## Concepto y narrativa

PokéAPI no dice dónde vive cada criatura, sólo su hábitat (bosque, pradera, montaña, orilla del agua…). PokeRadar le da un lugar en el mundo: cruza esos hábitats con las ecorregiones reales de Argentina (RESOLVE Ecoregions 2017) y reparte a las 386 criaturas de las generaciones I a III, las únicas que tienen hábitat en PokéAPI, sobre el terreno que les corresponde. Pikachu, de bosque, aparece en las yungas o en la selva misionera; Geodude, de montaña, en la puna o en los Andes. El mapa no es un fondo con marcadores: es el que explica por qué cada criatura está donde está.

- **Argentina como protagonista.** El país ocupa la pantalla, en vertical, pensado primero para el celular. El estilo del mapa es propio: sólo se rotulan provincias y ciudades argentinas, las Islas Malvinas llevan su rótulo y los hábitats tiñen el territorio con colores apagados de su bioma.
- **La llegada desde el espacio.** La primera visita empieza con el globo terráqueo y un vuelo hasta Argentina que pasa de la esfera al plano. Se corta con «Saltar» o con cualquier toque, rueda o tecla, y no corre con movimiento reducido ni al entrar por un link a una criatura.
- **Todo evento es el barrido de una cerca.** El descubrimiento se piensa como un radar: se elige una zona (una cerca), se barre y aparece lo que hay adentro, con el porqué de cada hallazgo. Un solo modelo mental para las cercas predefinidas por bioma, la cerca trazada a mano y, más adelante, los eventos en vivo.
- **Una paleta con origen.** Cada color sale de un lugar real del país: el fondo es la noche de la puna, el texto la sal de Salinas Grandes, el hábitat el ocre de la puna jujeña, la condición el hielo del Perito Moreno, la energía la flor del ceibo y la alerta el rojo de Talampaya. Los nueve hábitats toman el suyo de su bioma (yungas salteñas, pampa en primavera, esteros del Iberá, cerro de los Siete Colores…). Están en `src/app/globals.css`, cada uno comentado con su lugar.

### Qué aporta a la experiencia

- **La ubicación no es arbitraria.** Quien explora entiende por qué una criatura está ahí: el territorio está teñido por hábitat y la leyenda dice cuál es cuál. El reparto es el mismo para todos: cada criatura está en el mismo lugar en cualquier dispositivo y en cada visita.
- **Descubrir no es esperar.** El mapa no depende del catálogo (si PokéAPI tarda o falla, el mapa igual se puede usar), el vuelo de entrada se corta en cualquier momento y los puntos aparecen apenas llegan.
- **Primero el celular.** El mapa ocupa toda la pantalla, el detalle es una hoja inferior que no tapa el mapa (en escritorio, un panel flotante) y los controles tienen 44 px. La ayuda explica los gestos del dispositivo que se está usando: táctil, mouse o touchpad.
- **Se usa también con teclado y movimiento reducido.** El foco entra al panel al abrirlo y vuelve al cerrarlo, y sin animaciones el sprite queda quieto y el vuelo no corre.

### Qué hay en esta versión

- Mapa de Argentina con estilo propio, hábitats y los avistamientos como puntos tenues desde zoom 5.
- Vuelo de entrada salteable.
- Detalle de criatura con datos reales (nombre, tipos, estadísticas en barras, sprite animado y grito por acción del usuario), abierto por link (`/?creature=25`), con carga, error con reintento y cierre con «atrás».
- Gestos de touchpad (dos dedos mueven el mapa, el pellizco hace zoom) y una ayuda de controles según el dispositivo.
- Estados de mapa cargando, lento, con error y reintento, sin conexión y navegador sin WebGL2.
- La detección por cerca ya existe como función pura testeada (`src/domain/sightings/detect.ts`): hasta 12 criaturas trazadas por cerca y el resto como señales débiles. El evento de barrido sobre el mapa es la próxima unidad.

## Arquitectura y stack

| Pieza | Por qué |
| --- | --- |
| Next.js 16, App Router con Cache Components | El catálogo y los avistamientos se arman y cachean en el servidor con `"use cache"`; la portada queda prerenderizada y los datos llegan por streaming. |
| TypeScript estricto, sin `any` | `strict` en `tsconfig.json` y `@typescript-eslint/no-explicit-any` como error. Las respuestas externas se validan con zod en la frontera. |
| Tailwind CSS 4 | Tokens propios (color, tipografía, espaciado, radios, movimiento) que cierran la paleta por defecto: sólo existen los del sistema. Se ven en `/system`. |
| MapLibre GL sobre OpenFreeMap | Tiles vectoriales gratuitos, sin API key. Estilo propio en `src/map/style.ts`: filtro geométrico con el contorno de Argentina para los rótulos, capa propia para Malvinas y borde del globo dibujado con un color del sistema. |
| `motion` | Transiciones por estado (panel de detalle, botones); lo ambiental queda en CSS. Respeta `prefers-reduced-motion`. |
| next-intl | Interfaz en castellano (es-AR) desde `messages/es-AR.json`; código e identificadores en inglés. |
| zod | Esquemas de las respuestas de PokéAPI: si cambia la forma, falla la validación, no la pantalla. |
| Vitest + Testing Library + fast-check | Unitarios en node y jsdom; propiedades con fast-check para la geometría. |
| Playwright + axe | E2E en cinco perfiles, accesibilidad automática y capturas visuales. |

### Carpetas y fronteras

- `src/domain`: lógica pura (cercas, distancias, reglas). Sólo importa de `domain`; sin React, Next, `maplibre-gl`, red ni DOM.
- `src/features`: estado, almacenamiento y hooks por funcionalidad (`queries.ts`, `schema.ts`, `storage.ts`, `use-*.ts`); puede importar `domain`. `queries.ts` lleva `import "server-only"` y sólo se lee desde `src/app`.
- `src/hooks`: hooks genéricos sin negocio.
- `src/data`: datos estáticos (hábitats, sitios curados, cercas predefinidas); `domain` no lo importa.
- `src/lib`: utilidades de servidor sin negocio (`lib/upstream`: fetch validado, frontera de caché y respuestas de error).
- `src/map`: el único lugar que importa `maplibre-gl`; sólo conoce `domain` y recibe datos por props.
- `src/components`: piezas de interfaz; `components/ui` es presentación pura.
- `src/app`: rutas y composición. Lo que usa una sola ruta va en `src/app/<ruta>/_components/`.
- `src/i18n`: configuración de next-intl. `src/testing`: utilidades de test, que la app nunca importa.

Dirección de dependencias: `domain ← features ← components ← app`; `hooks` es transversal y `lib` es sólo de servidor. Las fronteras las fuerza `pnpm lint` (`eslint.config.mjs`, incluidos los `import()` dinámicos de MapLibre) y las protege un test de conformidad, `tooling/import-boundaries.test.ts`, con un caso prohibido y uno permitido por regla más cada fuga encontrada en revisión.

### Componentes

- **Primitivas** (`src/components/ui`): `Button`, `Notice`, `Tag`, `EnergyBar` y `Quantity`. Reciben todo por props, no conocen el dominio y se ven juntas en `/system`.
- **Piezas con dominio** (`src/components/creature`): `CreatureDetail` muestra los estados de carga, error con reintento y datos, y no sabe de dónde vienen.
- **Composición de la portada** (`src/app/_components`): `page.tsx` es un componente de servidor que arranca la carga de avistamientos y le pasa la promesa a `MapStage`, la isla de cliente. `MapStage` maneja los estados del mapa, la ayuda y el vuelo; `HabitatMap` le agrega los hábitats a `BaseMap` (`src/map`); `CreatureRoute` lee `?creature=` y monta `DetailPanel`, que pide el detalle con `useCreature` (`src/features/creature`).
- **La URL es el estado del panel.** Abrir una criatura suma una entrada al historial, «atrás» la cierra y un link compartido la abre.

### Servidor y cliente

- **Servidor.** El catálogo de 386 especies se arma con 27 llamadas a PokéAPI (9 hábitats y 18 tipos) y se cachea por días. Los avistamientos se calculan a partir del catálogo y se cachean igual. Los errores viajan como valor (`Loaded<T>`), no como excepción: un PokéAPI caído deja la capa vacía y el mapa sigue andando.
- **Endpoint propio de detalle.** `/api/creatures/[id]` valida el id, pide la criatura y su especie y devuelve sólo lo que la pantalla usa. El recurso original pesa cientos de KB; el recorte, unos pocos. No reenvía nada del pedido, así que no es un proxy abierto.
- **Cliente.** El mapa y MapLibre viven en un chunk diferido que sólo se carga en el navegador (`next/dynamic` con `ssr: false`), igual que el panel de detalle. `e2e/bundle.spec.ts` verifica en CI que el JS inicial no crezca más de 10 KB sobre la base y que MapLibre no aparezca en él.

### Datos

- **Hábitats.** `pnpm habitats:build` (`tooling/habitats/build.ts`) baja RESOLVE, recorta a Argentina, une las ecorregiones por hábitat y simplifica con mapshaper. La app sólo lee el GeoJSON resultante (`src/data/habitats.geojson`). El mar usa un polígono propio del Mar Argentino; ciudad, cueva y raro, sitios curados a mano.
- **Reparto determinista.** Cada especie se ubica con un generador con semilla (el id de la especie): las mismas criaturas en los mismos lugares para todos, unos 1.700 puntos en total.

### Calidad

- CI en cada PR: lint, tipos, unitarios con umbral de cobertura, build, E2E y auditoría de dependencias (`pnpm audit`).
- E2E en cinco perfiles (Chrome, Firefox y Safari de escritorio, Android e iPhone): chromium corre todo y los demás los flujos `@critical`; las ramas de release corren la suite completa en todos. Ningún test pega contra los servicios reales: PokéAPI y OpenFreeMap se reemplazan por fixtures.
- Accesibilidad automatizada: axe con las reglas de WCAG 2.2 AA corre en E2E sobre la portada, el mapa cargado, la ayuda de controles (escritorio y celular), el detalle y `/system`; otros E2E recorren el orden de foco y el anillo de foco con teclado. Un test (`tooling/tokens.test.ts`) exige el contraste mínimo de cada par de colores según su uso y falla si algún archivo de `src` usa un color fuera de los tokens.
- Rendimiento automatizado: el presupuesto de JS inicial (`e2e/bundle.spec.ts`) y un E2E que mide el desplazamiento de layout (CLS) durante la carga del mapa y falla por encima de 0,01.
- Capturas visuales con base en Linux, regenerada en Docker.
- Cabeceras de seguridad con CSP, `nosniff`, `Referrer-Policy` y `Permissions-Policy` (`next.config.ts`), verificadas en `e2e/security.spec.ts`.

### Flujo de trabajo

Gitflow: `main` para producción, `develop` como base y una rama `feat/*`, `fix/*` o `chore/*` por unidad de trabajo, con PR a `develop` y squash. Una política de CI rechaza ramas y títulos de PR que no sigan la convención. Commits firmados, en castellano, `tipo(alcance): asunto`.

## Uso de inteligencia artificial

### Herramientas

- **Claude Code** como agente principal, con subagentes para implementar y para revisar.
- **Worktrees de Orca** para correr varias unidades en paralelo, con un agente por rama.
- **Claude Design** para armar artefactos que comparan paletas del mapa y direcciones de arte lado a lado antes de decidir.
- **Skills de revisión**: `vercel-react-best-practices` e `impeccable`. Con `impeccable critique` la IA evalúa una pantalla con las 10 heurísticas de Nielsen y le pone puntaje a cada una. No es un test automático: el informe lo lee una persona y decide qué se corrige.
- **Revisión en dos lentes por unidad**: una contra la spec, la calidad y las reglas del repo; otra con las buenas prácticas de React y Next. Los hallazgos de las dos van en una sola ronda de arreglos.

### Para qué

Specs y planes por unidad, implementación con TDD, revisiones independientes del código de otro agente, preprocesado de los datos geográficos (el script de RESOLVE y el contorno de Argentina) y auditoría de los commits antes de cada push.

### Dónde se equivocó y cómo se intervino

Cada unidad pasa por una revisión independiente antes del PR y por una prueba manual en el navegador, y cada bug se arregla con un test que primero lo reproduce. Los errores de abajo salieron de esas dos fuentes. Lo que marca la revisión lo lee una persona, que decide si es real y cómo se corrige.

**Afirmó o asumió cosas sin verificarlas**

- Asumió que la cuenta de `gh` activa era la que decía la etiqueta, y commiteó con la identidad global en lugar de la del proyecto.
  → Identidad, firma y `gh` propios del repo, y commits rehechos.
- Fijó como «última» una versión de jsdom publicada ese mismo día, y pnpm agregó solo una excepción a su guarda de antigüedad mínima.
  → Se volvió a la versión anterior y se quitó la excepción.
- Siguió la documentación al pie de la letra y sumó un plugin de alias que Vitest 5 ya no necesitaba (el propio Vitest avisaba).
  → Se usa la resolución nativa.
- Tapó un error de tipos con `typeRoots` en vez de buscar la causa: un `node_modules` huérfano fuera del proyecto.
  → Se fue a la causa: se borró la carpeta y se quitó el parche.

**Se salió del proceso o del alcance**

- Salteó la spec y el plan de algunas unidades por interpretar de más una decisión.
  → Se reconstruyeron como specs combinadas y quedó la regla de que toda unidad deja su spec.
- Usó un prefijo de rama que la convención no admite (`ci/`) y commits `test(...)` en ramas `feat/*`.
  → Rama renombrada. Desde entonces los commits se auditan al cerrar cada rama y se reescriben antes del push.
- Un agente sumó páginas de error dentro de la rama de gestos.
  → Se separaron en su propia rama, con su propia revisión.

**Eligió lo genérico**

- Propuso la paleta neón de «radar» (amarillo y cian sobre azul casi negro) que repiten los generadores, y dejó el halo de atmósfera por defecto del mapa.
  → El autor pidió colores con origen. La paleta sale de biomas argentinos y el globo lleva un borde propio con un color del sistema.

**Bugs que llegaron hasta la revisión o la prueba manual**

- El estilo del mapa rotulaba provincias y ciudades de países vecinos.
  → Lo vio el autor al probar; filtro geométrico con el contorno de Argentina.
- Faltaba el rótulo «Islas Malvinas».
  → Lo detectó la revisión final; capa propia desde los datos de los tiles.
- El botón «Saltar» producía un error de hidratación en cada carga.
  → Lo detectó la revisión; se arregló y se agregó un E2E que falla ante cualquier error de consola.
- Precargaba el panel de detalle para todos los visitantes.
  → Lo marcó la revisión de buenas prácticas; ahora se precarga por intención (hover o foco).
- Cerrar el detalle con doble clic hacía dos `history.back()` y podía sacar al usuario de la app.
  → Guarda en el historial y test.
- Una corrección convertía cualquier tile fallido en «error del mapa».
  → Se acotó a fallas del estilo o de la fuente antes de la carga.
- La rueda del mouse en macOS se leía como touchpad.
  → La revisión lo comparó con la regla de MapLibre; se corrigió con test.
- Firefox se colgaba al pasar axe por una región ARIA anidada.
  → Se aisló regla por regla y se corrigió el marcado.
- Un merge sin conflictos dejó dos claves `Habitats` en el JSON de textos, y `JSON.parse` se queda con la última sin avisar.
  → Test de conformidad del catálogo de mensajes.
- Un E2E inestable leía el anillo de foco en plena transición de color.
  → Ahora espera el valor final.

La IA aceleró casi todo, pero la calidad no salió de ahí: salió de revisiones independientes, de tests que reproducen el error antes del arreglo y de decisiones de producto tomadas por una persona.

## Próximos pasos (con una semana más)

**Producto**

- Evento de barrido sobre el mapa y lectura de la cerca: cantidad, área, composición por hábitat y tipo, hallazgo más raro.
- Cerca trazada a mano y su versión por teclado (centro elegido de una lista y radio), para que el trazado sea accesible.
- Cercas guardadas y link compartible con los vértices y la criatura abierta.
- Clima real (Open-Meteo) como modificador de qué aparece, explicado en pantalla.
- Sismos recientes (USGS) y aviso al volver si cayó uno dentro de una cerca guardada.
- Contador de descubiertas sobre 386.
- Nombres en castellano en los marcadores.
- Extensión a América.

**Técnico**

- Avisos con la app cerrada: cercas en servidor, cron y base de datos que las crucen con eventos nuevos.
- Caché sin conexión con service worker.
- Pruebas en dispositivos reales y con lector de pantalla.
- Auditoría WCAG 2.2 AA completa.
- Presupuesto de rendimiento medido en un celular de gama media.

## Requisitos

- Node.js 22.22.2+, 24.15+ o 26+
- pnpm

## Desarrollo

```bash
pnpm install
pnpm dev
```

La app queda disponible en http://localhost:3000.

## Scripts

| Comando                | Descripción                                    |
| ---------------------- | ---------------------------------------------- |
| `pnpm dev`             | Servidor de desarrollo                         |
| `pnpm build`           | Build de producción                            |
| `pnpm start`           | Sirve el build de producción                   |
| `pnpm lint`            | Linter (incluye las fronteras de carpetas)     |
| `pnpm typecheck`       | Chequeo de tipos                               |
| `pnpm test`            | Tests (una pasada)                             |
| `pnpm test:watch`      | Tests en modo watch                            |
| `pnpm test:coverage`   | Tests con umbral de cobertura                  |
| `pnpm e2e`             | Playwright en chromium                         |
| `pnpm e2e:critical`    | Tests `@critical` en los 5 perfiles            |
| `pnpm e2e:screenshots` | Regenera la base visual de Linux (Docker)      |
| `pnpm habitats:build`  | Regenera los hábitats desde RESOLVE            |

## Base de capturas visuales

La base oficial se genera en Linux, porque el render de fuentes cambia entre sistemas. Para actualizarla:

1. Con el árbol limpio en `src/` y `e2e/`, correr `pnpm e2e:screenshots` (requiere Docker): regenera la base desde el último commit.
2. Revisar el diff de los PNG en `e2e/__screenshots__/linux/`.
3. Commitear sólo esa carpeta, con commit firmado.

Las capturas locales de Windows (`e2e/__screenshots__/win32/`) son personales y no se versionan. Playwright usa el puerto 3100, así que un `pnpm dev` en el 3000 no interfiere. Con varios worktrees corriendo E2E a la vez, cada uno necesita su puerto (`E2E_PORT=3107 pnpm e2e`): si no, `reuseExistingServer` puede tomar el servidor de otro. Los fixtures de PokéAPI usan el puerto siguiente, así que conviene dejar libres los dos.

## Navegadores

Chrome y Edge 111+, Safari 16.4+ (macOS e iOS) y Firefox 128+, con WebGL2. Sin WebGL2 la app avisa que el navegador no puede mostrar el mapa.

## Presupuesto de JS inicial

`e2e/bundle.spec.ts` compara el JS inicial de `/` (gzip) con `tooling/initial-js-baseline.json` y falla si crece más de 10 KB o si aparece MapLibre. Si un aumento es intencional, medir de nuevo sobre `develop` con `measureInitialJs` (`e2e/helpers.ts`) y actualizar ese archivo en el mismo PR, explicando por qué.

## Atribuciones

- Mapa: © [OpenFreeMap](https://openfreemap.org) · © [OpenMapTiles](https://openmaptiles.org) · Datos de © [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Ecorregiones: Ecoregions 2017 © [RESOLVE](https://ecoregions.appspot.com), bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Contorno de Argentina: [Natural Earth](https://www.naturalearthdata.com) (dominio público).
- Criaturas, tipos, hábitats, sprites y sonidos: [PokéAPI](https://pokeapi.co). Las criaturas, sus nombres y sus imágenes pertenecen a sus dueños; acá se usan con fines de demostración.
