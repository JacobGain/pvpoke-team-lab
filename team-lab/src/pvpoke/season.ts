// The active bundle is pinned independently of upstream's production/preview switch.
export const ACTIVE_SEASON = {
  number: 28,
  title: "Twilight Trails",
  upstreamBranch: "master",
  upstreamCommit: "d98f52174e01f8f67414bc6973599788d098c10e",
} as const;

// Keep the outgoing pin when advancing upstream so roster changes are reproducible.
export const UPSTREAM_COMPARISON_COMMIT = "bdbb22c6888d0999f9bee1712a0296309dcab3fb";
