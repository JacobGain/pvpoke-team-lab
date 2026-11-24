// The active bundle is pinned independently of upstream's production/preview switch.
export const ACTIVE_SEASON = {
  number: 28,
  title: "Twilight Trails",
  upstreamBranch: "master",
  upstreamCommit: "797820327642f49deb8e9706492090ccac680bc7",
} as const;

// Keep the outgoing pin when advancing upstream so roster changes are reproducible.
export const UPSTREAM_COMPARISON_COMMIT = "a8c817915e2978b433a38317b93dce267b64bde7";
