# PokeRadar Geoespacial

Aplicación web construida con Next.js 16 (App Router), TypeScript y Tailwind CSS 4.

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

| Comando              | Descripción                   |
| -------------------- | ----------------------------- |
| `pnpm dev`           | Servidor de desarrollo        |
| `pnpm build`         | Build de producción           |
| `pnpm start`         | Sirve el build de producción  |
| `pnpm lint`          | Linter                        |
| `pnpm typecheck`     | Chequeo de tipos              |
| `pnpm test`          | Tests (una pasada)            |
| `pnpm test:watch`    | Tests en modo watch           |
| `pnpm test:coverage` | Tests con umbral de cobertura |
| `pnpm e2e`           | Playwright en chromium        |
| `pnpm e2e:critical`  | Tests `@critical` en los 5 perfiles |
| `pnpm e2e:screenshots` | Regenera la base visual de Linux (Docker) |

## Base de capturas visuales

La base oficial se genera en Linux, porque el render de fuentes cambia entre sistemas. Para actualizarla:

1. Con el árbol limpio en `src/` y `e2e/`, correr `pnpm e2e:screenshots` (requiere Docker): regenera la base desde el último commit.
2. Revisar el diff de los PNG en `e2e/__screenshots__/linux/`.
3. Commitear sólo esa carpeta, con commit firmado.

Las capturas locales de Windows (`e2e/__screenshots__/win32/`) son personales y no se versionan. Playwright usa el puerto 3100, así que un `pnpm dev` en el 3000 no interfiere.
