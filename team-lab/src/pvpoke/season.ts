// The active bundle is pinned independently of upstream's production/preview switch.
export const ACTIVE_SEASON = {
  number: 28,
  title: "Twilight Trails",
  upstreamBranch: "master",
  upstreamCommit: "bdbb22c6888d0999f9bee1712a0296309dcab3fb",
} as const;

// Keep the outgoing pin when advancing upstream so roster changes are reproducible.
export const UPSTREAM_COMPARISON_COMMIT = "e87448291024aff808f21a2e5f74e69f68b521df";
