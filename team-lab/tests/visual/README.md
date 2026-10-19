# TeamLab visual regression

The checked-in PNGs under `baselines/` cover:

- the dashboard and rankings at desktop and narrow mobile widths;
- the guided inventory form at tablet width and owned inventory/team cards;
- simulation evidence and recommendation results at desktop and mobile widths;
- release notes and footer navigation at desktop and mobile widths.

The 1.3.0 refresh records the October 17, 2026 rankings, updated release
identity, and current Chrome scrollbar rendering. Review data-derived scores,
matchups, dates, and release notes when refreshing these snapshots.

Verify them with:

```bash
npm run test:visual
```

When an intentional UI change fails comparison, inspect
`artifacts/visual/*.actual.png` and `*.diff.png`. After approving the change,
regenerate and review the baselines with:

```bash
npm run update:visual
```

The comparator tolerates small per-channel rendering differences and permits
at most one percent changed pixels. Never update baselines merely to silence a
failure; the PNG diff is part of review.
