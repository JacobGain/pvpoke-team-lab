import { fileURLToPath, URL } from "node:url";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

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
  const dashboardContents = await readFile(
    "public/vendor/pvpoke/data/dashboard.json",
  );
  const dashboardSha256 = createHash("sha256")
    .update(dashboardContents)
    .digest("hex");

  return {
    base: environment.VITE_BASE_PATH || "/",
    build: {
      outDir: diagnosticsEnabled ? "dist-admin" : "dist",
    },
    define: {
      __TEAMLAB_DIAGNOSTICS__: JSON.stringify(diagnosticsEnabled),
      __TEAMLAB_VERSION__: JSON.stringify(releaseMetadata.appVersion),
      __TEAMLAB_DASHBOARD_SHA256__: JSON.stringify(dashboardSha256),
    },
    plugins: [react(), releaseMetadataPlugin(releaseMetadata)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        // Dexie's conditional production export wraps a pre-minified UMD build.
        // Bundle its native ESM entry in every mode so production and
        // development use the same IndexedDB implementation.
        dexie: fileURLToPath(
          new URL("./node_modules/dexie/dist/dexie.mjs", import.meta.url),
        ),
      },
    },
  };
});
