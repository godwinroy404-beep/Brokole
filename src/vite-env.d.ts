/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the PHP API, e.g. https://brokole.com/api */
  readonly VITE_API_URL?: string;
  readonly VITE_SHOPIFY_STORE_DOMAIN?: string;
  readonly VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
