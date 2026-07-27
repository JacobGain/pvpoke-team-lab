# Style architecture and visual regression

> **Status:** Active maintenance contract
> **Last reviewed:** 2026-07-26

## Outcome

The former 4,248-line global stylesheet is now a small, ordered import entry
point backed by focused modules under `src/styles/modules/`. The Battle
Dossier redesign adds a final intentional presentation layer that gives every
feature a shared tournament-field-guide language while the feature modules
continue to own their layout semantics.

The split was deliberately mechanical. Concatenating the modules in import
order produces the same source hash as the stylesheet before the split, and
the production build retained the same compiled CSS asset hash. This preserves
the existing cascade while making ownership and future cleanup clearer.

## Import-order contract

`src/styles/global.css` is the only stylesheet imported by the application.
Its order is intentional:

1. `fonts.css` — locally bundled font files and replaceable family tokens;
2. `foundation.css` — reset, tokens, typography, and document defaults;
3. `maintenance-overrides.css` — shared accessibility and compatibility fixes;
4. `shell.css` — application chrome and global navigation;
5. `dashboard.css` — dashboard composition;
6. `primitives.css` — shared controls, cards, sprites, and empty states;
7. `responsive-shell.css` — global responsive behavior;
8. `modern-feature-overrides.css` — transition layer for the former theme;
9. `catalog.css` — catalog and rankings;
10. `inventory.css` — inventory list and guided form;
11. `analysis.css` — individual Pokémon analysis;
12. `teams-simulation.css` — team builder and simulation results;
13. `recommendations.css` — recommendation request and results; and
14. `battle-dossier.css` — final shared art direction, adaptive shell, and
    cross-feature presentation contract.

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
- Keep deployment branding configurable through the custom properties in
  `fonts.css` and `battle-dossier.css`. Components must not name a font family
  or deployment-specific color directly.
- Fontsource packages are build-time assets. TeamLab does not require a
  third-party font service at runtime.

CSS Modules or another component-scoping system may be considered later, but
adopting one is not required to keep the current MVP maintainable.

## Visual regression contract

Checked-in screenshots cover the highest-value presentation states:

- dashboard command rail and mobile battle desk;
- rankings, expansion details, and adaptive navigation;
- guided inventory entry at 768 × 1000;
- desktop inventory and saved-team records;
- desktop and mobile simulation evidence; and
- desktop and mobile recommendation results.

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
