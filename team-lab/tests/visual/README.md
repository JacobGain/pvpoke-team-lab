# TeamLab visual regression

The checked-in PNGs under `baselines/` cover:

- Rankings and the desktop application shell at 1440 × 1000;
- the guided inventory form at the 768 × 1000 tablet width;
- simulation score and threat evidence at 1440 × 1000; and
- the same simulation evidence at the supported 320 × 900 mobile width.

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
