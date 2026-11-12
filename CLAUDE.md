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

## Commits y comentarios

- Commits `tipo(alcance): asunto` en castellano, asunto en minúscula. El tipo coincide con el prefijo de la rama.
- Nunca mencionar en commits, PRs ni comentarios quién pidió el cambio ni de qué conversación salió.
- Comentarios en inglés, cortos y sólo el porqué.
- Nunca commitear archivos `.env*`.
