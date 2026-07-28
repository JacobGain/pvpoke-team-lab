import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import {
  defineConfig,
  loadEnv,
  type Plugin,
} from "vite";

import {
  createReleaseMetadata,
  type TeamLabReleaseMetadata,
} from "./scripts/release-metadata.ts";

function releaseMetadataPlugin(
  metadata: TeamLabReleaseMetadata,
): Plugin {
  return {
    name: "teamlab-release-metadata",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "release.json",
        source: `${JSON.stringify(metadata, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(async ({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const diagnosticsEnabled =
    mode === "development" ||
    environment.VITE_ENABLE_DIAGNOSTICS === "true";
  const releaseMetadata = await createReleaseMetadata(
    process.cwd(),
    diagnosticsEnabled ? "admin" : "public",
  );

  return {
    base: environment.VITE_BASE_PATH || "/",
    build: {
      outDir: diagnosticsEnabled ? "dist-admin" : "dist",
    },
    define: {
      __TEAMLAB_DIAGNOSTICS__: JSON.stringify(diagnosticsEnabled),
    },
    plugins: [react(), releaseMetadataPlugin(releaseMetadata)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
