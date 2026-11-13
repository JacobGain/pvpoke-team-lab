# TeamLab visual regression

The checked-in PNGs under `baselines/` cover:

- the dashboard and rankings at desktop and narrow mobile widths;
- the guided inventory form at tablet width and owned inventory/team cards;
- simulation evidence and recommendation results at desktop and mobile widths;
- release notes and footer navigation at desktop and mobile widths;
- roster update review at desktop and narrow mobile widths;
- Super Mega inventory controls, bulk entry, and replay at widths down to 320px.

The 1.4.0 release retains the November 9, 2026 ranking pin and adds four
reviewed Super Mega snapshots plus updated release-note snapshots. There are
21 baselines in total. Review data-derived scores,
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
