# Phase 0 — Application Foundation

> **Status:** Complete  
> **Project-plan phase:** Phase 0: foundation  
> **Implemented in:** `3dcc89fa5`  
> **Last reviewed:** 2026-07-24

## Objective

Create a minimal, production-shaped TeamLab frontend that can grow
independently from upstream PvPoke.

The foundation needed to:

- live entirely under `team-lab/`;
- use a modern typed frontend stack;
- provide routing and provider composition;
- enforce strict static checks;
- build without upstream source changes;
- avoid prematurely implementing product features.

## Implemented scope

- React 19 application entry
- TypeScript 6 project references and strict compiler options
- Vite 8 development and production builds
- React Router application routing
- TanStack Query provider
- global application styling
- ESLint with typed TypeScript and React rules
- TeamLab-specific package manifest, lockfile, and ignore rules
- dependency installation for planned MVP libraries
- minimal home and not-found pages

## Out of scope

- product navigation
- inventory
- domain persistence
- upstream engine loading
- authentication
- Firebase
- testing framework setup
- component library selection
- final visual design

## Implementation records

- [Frontend and UI foundation](frontend-and-ui-foundation.md)

## Important decisions

### React, TypeScript, and Vite

The application uses React for the UI, strict TypeScript for internal
contracts, and Vite for development/build tooling.

### TypeScript 6 rather than 7

TypeScript 7 was current when the scaffold was created, but the current
`typescript-eslint` release supported TypeScript versions below 6.1.

The project uses TypeScript `6.0.3` instead of bypassing peer-dependency
validation. This keeps typed lint rules reliable.

### Dependencies installed without premature wrappers

Zod, Dexie, React Hook Form, Zustand, and other planned libraries were
installed, but empty abstractions were not created before their real domain
requirements existed.

### TeamLab-only configuration

Frontend tooling is contained under `team-lab/`. Upstream PHP, JavaScript,
Docker, and CSS configuration remain untouched.

## Validation

```bash
cd team-lab
npm run typecheck
npm run lint
npm run build
```

All passed at phase completion.

The initial dependency installation reported zero known vulnerabilities.

## Known limitations

- The initial UI is a functional shell, not a final design system.
- No test runner is configured.
- TeamLab is not yet mounted into the upstream Docker service.
- Development currently uses the Vite server separately from Apache.
- The global CSS file will need decomposition as reusable UI primitives grow.

## Exit criteria

- [x] TeamLab starts independently.
- [x] Home route renders.
- [x] Unknown routes render a not-found state.
- [x] strict type checking passes.
- [x] typed linting passes.
- [x] production build passes.
- [x] upstream `src/` remains untouched.

## Next phase dependencies

Phase 1 relies on:

- `AppProviders` for TanStack Query;
- Vite environment loading and proxy support;
- router registration;
- strict TypeScript and runtime-validation dependencies.

## Relevant commits

```text
3dcc89fa5  mega commit: react 19, ts6, vite 8, zod, dexie, etc.
```
