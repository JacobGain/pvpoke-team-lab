import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const diagnosticsEnabled =
    mode === "development" ||
    environment.VITE_ENABLE_DIAGNOSTICS === "true";

  return {
    base: environment.VITE_BASE_PATH || "/",
    build: {
      outDir: diagnosticsEnabled ? "dist-admin" : "dist",
    },
    define: {
      __TEAMLAB_DIAGNOSTICS__: JSON.stringify(diagnosticsEnabled),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
