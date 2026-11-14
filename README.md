# PokeRadar Geoespacial

Una expedición sobre el mapa de Argentina: las criaturas de PokéAPI aparecen en ecorregiones reales y cada ubicación tiene su porqué.

**App:** <!-- URL de producción -->

> En esta versión el detalle de una criatura se abre por link, por ejemplo `/?creature=25`. Tocar un marcador en el mapa llega con el evento de barrido, la próxima unidad.

## 1. Concepto y narrativa

PokéAPI no dice dónde vive cada criatura, sólo su hábitat (bosque, pradera, montaña, orilla del agua…). PokeRadar le da un lugar: cruza esos hábitats con las ecorregiones reales de Argentina (RESOLVE Ecoregions 2017) y reparte a las 386 criaturas de las generaciones I a III, las únicas con hábitat en PokéAPI, sobre el terreno que les corresponde. Pikachu, de bosque, aparece en las yungas o en la selva misionera; Geodude, de montaña, en la puna o en los Andes. El mapa no es un fondo con marcadores: es lo que explica por qué cada criatura está donde está.

- **Argentina como protagonista.** El país llena la pantalla, pensado primero para el celular. El estilo del mapa es propio: sólo se rotulan provincias y ciudades argentinas, las Islas Malvinas llevan su rótulo y los hábitats tiñen el territorio con el color de su bioma.
- **La llegada desde el espacio.** La primera visita empieza con el globo terráqueo y un vuelo hasta Argentina que pasa de la esfera al plano. Se corta con «Saltar» o con cualquier toque, rueda o tecla.
- **Una paleta con origen.** Cada color sale de un lugar real: el fondo es la noche de la puna, el texto la sal de Salinas Grandes, el hábitat el ocre de la puna jujeña, la energía la flor del ceibo y la alerta el rojo de Talampaya. Cada hábitat toma el suyo de su bioma (yungas salteñas, esteros del Iberá, cerro de los Siete Colores…).
- **Todo evento es el barrido de una cerca.** El descubrimiento se diseñó como un radar: se elige una zona (una cerca), se barre y aparece lo que hay adentro, con el porqué de cada hallazgo. La detección ya está como lógica pura testeada (hasta 12 criaturas trazadas por cerca, el resto como señales débiles); el barrido sobre el mapa es la próxima unidad.

**Qué aporta a la experiencia**

- **La ubicación no es arbitraria:** el territorio está teñido por hábitat y la leyenda dice cuál es cuál. El reparto es determinista: cada criatura está en el mismo lugar para todos.
- **Descubrir no es esperar:** el mapa no depende del catálogo (si PokéAPI falla, se sigue usando), el vuelo se corta en cualquier momento y los puntos aparecen apenas llegan.
- **Primero el celular:** mapa a pantalla completa, detalle en una hoja inferior que no tapa el mapa (en escritorio, panel flotante), controles de 44 px y una ayuda con los gestos del dispositivo que se está usando.
- **Para todos:** se usa con teclado (el foco entra al panel al abrirlo y vuelve al cerrarlo), y con movimiento reducido no hay vuelo y el sprite queda quieto.

## 2. Arquitectura y stack

| Librería | Por qué |
| --- | --- |
| Next.js 16 (App Router, Cache Components) | Catálogo y avistamientos se arman y cachean en el servidor con `"use cache"`; la portada queda prerenderizada y los datos llegan por streaming. |
| TypeScript estricto | `strict` y `no-explicit-any` en error (de `eslint-config-next/typescript`): no hay ningún `any` en el código. |
| Tailwind CSS 4 | Tokens propios que reemplazan la paleta por defecto; se ven en `/system`. |
| MapLibre GL + OpenFreeMap | Tiles vectoriales gratuitos, sin API key, con estilo propio (`src/map/style.ts`). |
| `motion` | Transiciones por estado del panel; lo ambiental queda en CSS. |
| next-intl | Interfaz en castellano (es-AR) desde `messages/es-AR.json`. |
| zod | Valida las respuestas de PokéAPI en la frontera. |
| Vitest, Testing Library, fast-check | Unitarios, componentes por rol y texto, propiedades para la geometría. |
| Playwright + axe | E2E en cinco perfiles (escritorio y celular), WCAG 2.2 AA automatizado y capturas visuales. |

**Carpetas.** Las dependencias van en una sola dirección, `domain ← features ← components ← app`, y `pnpm lint` las hace cumplir. Un test de conformidad (`tooling/import-boundaries.test.ts`) protege cada regla.

- `src/domain`: lógica pura (cercas, geometría, reparto, detección), sin React, red ni DOM.
- `src/features`: datos y estado por funcionalidad; `queries.ts` es sólo de servidor.
- `src/map`: el único lugar que importa MapLibre; recibe datos por props.
- `src/components`: interfaz; `components/ui` es presentación pura.
- `src/app`: rutas y composición; lo que usa una sola ruta va en `_components/`.
- `src/lib` (utilidades de servidor), `src/hooks` (hooks genéricos), `src/data` (hábitats preprocesados y sitios), `src/i18n` y `src/testing`.

**Componentes.**

- `page.tsx` es un componente de servidor: arranca la carga de avistamientos y le pasa la promesa a `MapStage`, la isla de cliente.
- `MapStage` maneja los estados del mapa (cargando, lento, error, sin conexión, sin WebGL2), la ayuda y el vuelo.
- MapLibre y el panel de detalle se cargan en diferido, sólo en el navegador, y CI verifica que no entren al JS inicial.
- El detalle se pide a un endpoint propio (`/api/creatures/[id]`) que recorta la respuesta de PokéAPI de cientos de KB a unos pocos.
- La URL es el estado del panel: «atrás» lo cierra y un link lo abre.
- Las primitivas de `components/ui` (`Button`, `Notice`, `Tag`, `EnergyBar`, `Quantity`) no conocen el dominio.

Más detalle de servidor y cliente, datos, calidad (CI, accesibilidad, rendimiento, seguridad) y flujo de trabajo en [ARQUITECTURA.md](ARQUITECTURA.md).

## 3. Uso de inteligencia artificial

**Herramientas**

- **Claude Code** como agente principal, con subagentes para implementar y para revisar.
- **Worktrees de Orca** para correr varias unidades en paralelo, con subagentes trabajando cada uno en su propia rama.
- **Claude Design** para comparar paletas del mapa y direcciones de arte lado a lado antes de decidir.
- **Skills de revisión**: `vercel-react-best-practices` (rendimiento en React y Next) e `impeccable` (diseño de interfaz; su `critique` puntúa una pantalla con las 10 heurísticas de Nielsen y el informe lo lee una persona).
- **Revisión en dos lentes por unidad**: una contra la spec, la calidad y las reglas del repo; otra con buenas prácticas de React y Next.

**Para qué:** specs y planes por unidad, implementación con TDD, revisión independiente del código de otro agente, preprocesado de los datos geográficos y auditoría de commits antes de cada push.

**Dónde se equivocó y cómo se intervino**

Cada unidad pasa por una revisión independiente y por una prueba manual en el navegador, y cada bug entra con un test que primero lo reproduce. Lo que marca una revisión lo lee una persona, que decide si es real y cómo se corrige.

*Afirmó o asumió sin verificar*

- Asumió que la cuenta de `gh` activa era la que decía la etiqueta, y commiteó con la identidad global.
  → Identidad, firma y `gh` propios del repo, y commits rehechos.
- Fijó como «última» una versión de jsdom publicada ese mismo día, y pnpm agregó solo una excepción a su guarda de antigüedad mínima.
  → Se volvió a la versión anterior y se quitó la excepción.
- Tapó un error de tipos con `typeRoots` en vez de buscar la causa (un `node_modules` huérfano fuera del proyecto).
  → Se fue a la causa y se quitó el parche.

*Se salió del proceso o del alcance*

- Salteó la spec y el plan de algunas unidades por interpretar de más una decisión.
  → Se reconstruyeron y quedó la regla de que toda unidad deja su spec.
- Usó un prefijo de rama que la convención no admite y commits `test(...)` en ramas `feat/*`.
  → Desde entonces los commits se auditan al cerrar cada rama y se reescriben antes del push.
- Un agente sumó páginas de error dentro de la rama de gestos.
  → Se separaron en su propia rama, con su propia revisión.

*Eligió lo genérico*

- Propuso la paleta neón de «radar» (amarillo y cian sobre azul casi negro) y dejó el halo de atmósfera por defecto del mapa.
  → El autor pidió colores con origen: la paleta sale de biomas argentinos y el globo lleva un borde propio.

*Bugs que llegaron a la revisión o a la prueba manual*

- El mapa rotulaba provincias y ciudades de países vecinos.
  → Lo vio el autor al probar; filtro geométrico con el contorno de Argentina.
- Faltaba el rótulo «Islas Malvinas».
  → Lo detectó la revisión final; capa propia desde los datos de los tiles.
- El botón «Saltar» producía un error de hidratación en cada carga.
  → Lo detectó la revisión; se agregó un E2E que falla ante cualquier error de consola.
- Cerrar el detalle con doble clic hacía dos `history.back()` y podía sacar al usuario de la app.
  → Guarda en el historial y test.
- La rueda del mouse en macOS se leía como touchpad.
  → La revisión lo comparó con la regla de MapLibre; se corrigió con test.

La IA aceleró el trabajo; la calidad salió de las revisiones independientes, de los tests que reproducen cada error y de las decisiones de producto tomadas por una persona.

## 4. Próximos pasos (con una semana más)

**Producto**, en orden:

1. Evento de barrido y lectura de la cerca: cantidad, área, composición por hábitat y tipo, hallazgo más raro.
2. Cerca trazada a mano y su versión por teclado (centro elegido de una lista y radio).
3. Cercas guardadas y link compartible con los vértices y la criatura abierta.
4. Clima real (Open-Meteo) como modificador de qué aparece, explicado en pantalla.
5. Contador de descubiertas sobre 386 y nombres en castellano en los marcadores.
6. Sismos recientes (USGS) y aviso al volver si cayó uno dentro de una cerca guardada.

**Técnico**

1. Pruebas en dispositivos reales y con lector de pantalla; auditoría WCAG 2.2 AA completa.
2. Presupuesto de rendimiento medido en un celular de gama media.
3. Caché sin conexión con service worker.
4. Avisos con la app cerrada: cercas en servidor, con cron y base de datos que las crucen con eventos nuevos.

Más adelante: extender el mapa a América.

## Cómo correrlo

Requisitos: Node.js 22.22.2+, 24.15+ o 26+, y pnpm.

```bash
pnpm install
pnpm dev
```

La app queda en http://localhost:3000. Navegadores: Chrome y Edge 111+, Safari 16.4+ y Firefox 128+, con WebGL2. Scripts, tests y convenciones en [CONTRIBUTING.md](CONTRIBUTING.md).

## Atribuciones

- Mapa: © [OpenFreeMap](https://openfreemap.org) · © [OpenMapTiles](https://openmaptiles.org) · Datos de © [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Ecorregiones: Ecoregions 2017 © [RESOLVE](https://ecoregions.appspot.com), bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Contorno de Argentina: [Natural Earth](https://www.naturalearthdata.com) (dominio público).
- Criaturas, tipos, hábitats, sprites y sonidos: [PokéAPI](https://pokeapi.co). Las criaturas, sus nombres y sus imágenes pertenecen a sus dueños; acá se usan con fines de demostración.
