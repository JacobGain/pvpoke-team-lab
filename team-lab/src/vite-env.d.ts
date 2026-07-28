/// <reference types="vite/client" />

declare const __TEAMLAB_DIAGNOSTICS__: boolean;

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_ENABLE_DIAGNOSTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
