/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PENDO_API_KEY?: string;
  readonly VITE_PENDO_CDN_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
