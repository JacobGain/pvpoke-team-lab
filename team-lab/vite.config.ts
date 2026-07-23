import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");

  return {
    base: environment.VITE_BASE_PATH || "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/pvpoke": {
          target: environment.PVPOKE_DEV_PROXY_TARGET || "http://localhost",
          changeOrigin: true,
        },
      },
    },
  };
});
