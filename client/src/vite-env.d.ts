/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_ENV: string
  readonly VITE_WEBSOCKET_URL: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_TWILIO_ACCOUNT_SID: string
  readonly VITE_SENDGRID_API_KEY: string
  readonly VITE_SENTRY_DSN: string
  readonly VITE_ANALYTICS_TRACKING_ID: string
  readonly VITE_FEATURE_FLAGS_ENDPOINT: string
  readonly VITE_DATABASE_URL: string
  readonly VITE_REDIS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}