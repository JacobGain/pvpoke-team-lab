/// <reference types="vite/client" />

declare const __TEAMLAB_DIAGNOSTICS__: boolean;
declare const __TEAMLAB_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_ENABLE_DIAGNOSTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
