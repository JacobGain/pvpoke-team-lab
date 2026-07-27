# Frontend and UI Foundation

> **Phase:** Phase 0 — Application Foundation  
> **Status:** Complete  
> **Last reviewed:** 2026-07-24

## Summary

TeamLab has a bootable React application with a strict TypeScript build,
routing, query-provider composition, baseline responsive styling, and a clear
place for future features.

The implementation is intentionally small. It proves the application boundary
without creating placeholder product architecture that would need to be
rewritten later.

## Application flow

```text
index.html
    ↓
src/main.tsx
    ↓
App
    ↓
AppProviders
    ↓
RouterProvider
    ↓
Feature/page route
```

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/index.html` | Browser document and React mount point |
| `team-lab/src/main.tsx` | Root-element validation and React startup |
| `team-lab/src/app/App.tsx` | Top-level provider/router composition |
| `team-lab/src/app/AppProviders.tsx` | Long-lived application providers |
| `team-lab/src/app/router.tsx` | Central route definitions |
| `team-lab/src/app/routes/HomePage.tsx` | Initial home surface |
| `team-lab/src/app/routes/NotFoundPage.tsx` | Unknown-route fallback |
| `team-lab/src/styles/global.css` | Baseline and current shared page styling |
| `team-lab/vite.config.ts` | React plugin, alias, base path, and dev proxy |
| `team-lab/tsconfig.app.json` | Strict browser TypeScript rules |
| `team-lab/tsconfig.node.json` | Tooling/script TypeScript rules |
| `team-lab/eslint.config.js` | Typed TypeScript and React lint rules |

## Provider policy

`AppProviders` owns providers that are truly application-wide.

It currently creates one `QueryClient` per application mount and configures:

```text
retry: 1
staleTime: 5 minutes by default
```

Individual upstream-data queries can override stale time where versioned static
data should remain cached for the page session.

Providers should not be added merely because a library is installed.

## Routing policy

Routes are registered centrally. Feature pages live with their feature rather
than under a generic page directory.

Current routes:

```text
/          Home
/catalog   Great League catalog
*          Not found
```

Vite’s configured base path and React Router’s basename allow a future
deployment under `/lab/` without rewriting route definitions.

## Styling policy

The current UI establishes:

- responsive minimum widths;
- system-font typography;
- card surfaces;
- accessible text contrast;
- consistent spacing and borders;
- responsive catalog layouts.

This is not the final design system.

As implementation grows:

- tokens should move into dedicated style files;
- generic cards, controls, badges, and page shells should become reusable
  components;
- feature-specific styles should remain with their feature;
- type colors should be introduced through explicit tokens rather than ad hoc
  selectors.

## Dependencies

Runtime:

```text
React
React DOM
React Router
TanStack Query
Zod
Dexie
React Hook Form
Hook Form Zod resolvers
Zustand
```

Development:

```text
Vite
TypeScript
ESLint
typescript-eslint
React Hooks lint rules
React Refresh
React type packages
```

Libraries being installed does not authorize using all of them globally.

## Error behavior

- Missing `#root` throws a clear startup error.
- Unknown routes show a TeamLab not-found page.
- Feature-level data errors are handled by the owning feature.

A full application error boundary remains future work.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Known limitations

- No automated component tests.
- No application-wide error boundary.
- No finalized navigation shell.
- No reusable component library yet.
- Current CSS includes catalog-specific rules and should be reorganized later.

## Safe extension points

- Add routes in `src/app/router.tsx`.
- Add global providers only in `AppProviders`.
- Add reusable components under `src/components/`.
- Add feature pages under `src/features/<feature>/`.
- Configure deployment base through `VITE_BASE_PATH`.

## Relevant commits

```text
3dcc89fa5  mega commit: react 19, ts6, vite 8, zod, dexie, etc.
```
