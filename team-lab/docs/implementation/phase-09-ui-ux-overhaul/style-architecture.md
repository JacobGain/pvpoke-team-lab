# Style architecture and visual regression

> **Status:** Active maintenance contract
> **Last reviewed:** 2026-07-25

## Outcome

The former 4,248-line global stylesheet is now a small, ordered import entry
point backed by focused modules under `src/styles/modules/`.

The split was deliberately mechanical. Concatenating the modules in import
order produces the same source hash as the stylesheet before the split, and
the production build retained the same compiled CSS asset hash. This preserves
the existing cascade while making ownership and future cleanup clearer.

## Import-order contract

`src/styles/global.css` is the only stylesheet imported by the application.
Its order is intentional:

1. `foundation.css` — reset, tokens, typography, and document defaults;
2. `maintenance-overrides.css` — shared accessibility and compatibility fixes;
3. `shell.css` — application chrome and global navigation;
4. `dashboard.css` — dashboard composition;
5. `primitives.css` — shared controls, cards, sprites, and empty states;
6. `responsive-shell.css` — global responsive behavior;
7. `modern-feature-overrides.css` — transition layer for the modern theme;
8. `catalog.css` — catalog and rankings;
9. `inventory.css` — inventory list and guided form;
10. `analysis.css` — individual Pokémon analysis;
11. `teams-simulation.css` — team builder and simulation results; and
12. `recommendations.css` — recommendation request and results.

Do not alphabetize these imports. Later modules intentionally win parts of the
cascade.

## Maintenance rules

- Put new component styles in the narrowest owning feature module.
- Keep reusable primitives in `primitives.css`; avoid feature-specific rules
  there.
- Prefer existing design tokens over one-off color, spacing, and radius values.
- Treat `modern-feature-overrides.css` as a transition layer. When touching a
  rule there, move it to its owning module when that can be done without
  changing specificity or cascade behavior.
- Run the visual suite after any style, layout, navigation-label, or responsive
  breakpoint change.

CSS Modules or another component-scoping system may be considered later, but
adopting one is not required to keep the current MVP maintainable.

## Visual regression contract

Four checked-in screenshots cover the highest-value presentation states:

- Rankings and desktop navigation at 1440 × 1000;
- guided inventory entry at 768 × 1000;
- desktop simulation evidence at 1440 × 1000; and
- mobile simulation evidence at 320 × 900.

Verify the baselines with:

```bash
npm run test:visual
```

The runner fixes the viewport, light color scheme, reduced-motion preference,
font readiness, and image readiness before capture. Comparisons require exact
dimensions, allow a per-channel tolerance of 20, and fail above one percent
changed pixels. Failures write actual and highlighted-difference images under
`artifacts/visual/`.

For an intentional visual change, inspect those artifacts first, then update
and review the checked-in baselines:

```bash
npm run update:visual
```

The initial 320 px baseline exposed wrapped bottom-navigation labels despite
the page technically having no horizontal overflow. The mobile-only labels
were shortened to “Home” and “Find”; desktop labels remain unchanged. This is
the kind of legibility regression the screenshot layer complements, but does
not replace, browser workflow and overflow assertions for.

