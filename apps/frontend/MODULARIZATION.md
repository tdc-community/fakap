# Frontend modularization notes

## New structure

- `src/app`: app-level shell, providers, and router composition
- `src/pages`: route-level page components
- `src/features`: domain modules (`auth`, `wallet`, `vehicles`) with local services/styles
- `src/shared`: cross-feature types/utilities

## Path aliases

Configured in both `tsconfig.json` and `vite.config.ts`:

- `@app/*` → `src/app/*`
- `@pages/*` → `src/pages/*`
- `@features/*` → `src/features/*`
- `@shared/*` → `src/shared/*`

## Import conventions

- Prefer barrel imports at feature boundaries, e.g. `@features/auth`, not deep paths.
- Keep route composition in `src/app/router`.
- Keep app bootstrap in `src/main.tsx` and app providers in `src/app/providers`.

## Compatibility shims

- `src/routes.tsx` now re-exports `appRouter` from `src/app/router`.

## Follow-up refactor suggestions

- Extract stateful flows from `AppLayout` into feature hooks:
  - session/auth hook
  - wallet hook
  - vehicles feed + voting hook
  - modal/lightbox hook
- Split `AppLayout` UI blocks into presentational components under `src/app/layout` and/or feature UI folders.
- Remove deprecated legacy files once references are fully cleaned up.
