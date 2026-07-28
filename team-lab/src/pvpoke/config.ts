function joinAppAssetPath(relativePath: string): string {
  const appBaseUrl = import.meta.env.BASE_URL || "/";
  return `${appBaseUrl.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}

export const bundledPvpokeBaseUrl =
  joinAppAssetPath("vendor/pvpoke");
