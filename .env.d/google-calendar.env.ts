export {};

declare global {
  interface ImportMetaEnv {
    VITE_GOOGLE_API_KEY: string;
    VITE_GOOGLE_CLIENT_ID: string;
    VITE_GOOGLE_CLIENT_SECRET: string;
    VITE_GOOGLE_REDIRECT_URI: string;
    VITE_GOOGLE_PROJECT_ID: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
