# Desarrollo

Convenciones de código, ramas, commits y tests en [CLAUDE.md](CLAUDE.md). Arquitectura en [ARQUITECTURA.md](ARQUITECTURA.md).

## Requisitos

- Node.js 22.22.2+, 24.15+ o 26+
- pnpm (no npm ni yarn)

```bash
pnpm install
pnpm dev
```

## Scripts

| Comando                | Descripción                                |
| ---------------------- | ------------------------------------------ |
| `pnpm dev`             | Servidor de desarrollo                     |
| `pnpm build`           | Build de producción                        |
| `pnpm start`           | Sirve el build de producción               |
| `pnpm lint`            | Linter (incluye las fronteras de carpetas) |
| `pnpm typecheck`       | Chequeo de tipos                           |
| `pnpm test`            | Tests (una pasada)                         |
| `pnpm test:watch`      | Tests en modo watch                        |
| `pnpm test:coverage`   | Tests con umbral de cobertura              |
| `pnpm e2e`             | Playwright en chromium                     |
| `pnpm e2e:critical`    | Tests `@critical` en los 5 perfiles        |
| `pnpm e2e:screenshots` | Regenera la base visual de Linux (Docker)  |
| `pnpm habitats:build`  | Regenera los hábitats desde RESOLVE        |

## Base de capturas visuales

La base oficial se genera en Linux, porque el render de fuentes cambia entre sistemas. Para actualizarla:

1. Con el árbol limpio en `src/` y `e2e/`, correr `pnpm e2e:screenshots` (requiere Docker): regenera la base desde el último commit.
2. Revisar el diff de los PNG en `e2e/__screenshots__/linux/`.
3. Commitear sólo esa carpeta, con commit firmado.

Las capturas locales de Windows (`e2e/__screenshots__/win32/`) son personales y no se versionan.

## Puertos de E2E

Playwright usa el puerto 3100, así que un `pnpm dev` en el 3000 no interfiere. Con varios worktrees corriendo E2E a la vez, cada uno necesita su puerto (`E2E_PORT=3107 pnpm e2e`): si no, `reuseExistingServer` puede tomar el servidor de otro. Los fixtures de PokéAPI usan el puerto siguiente, así que conviene dejar libres los dos.

## Navegadores

Chrome y Edge 111+, Safari 16.4+ (macOS e iOS) y Firefox 128+, con WebGL2. Sin WebGL2 la app avisa que el navegador no puede mostrar el mapa.

## Presupuesto de JS inicial

`e2e/bundle.spec.ts` compara el JS inicial de `/` (gzip) con `tooling/initial-js-baseline.json` y falla si crece más de 10 KB o si aparece MapLibre. Si un aumento es intencional, medir de nuevo sobre `develop` con `measureInitialJs` (`e2e/helpers.ts`) y actualizar ese archivo en el mismo PR, explicando por qué.
