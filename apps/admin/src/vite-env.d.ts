/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the PHP API, e.g. https://brokole.com/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
