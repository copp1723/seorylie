// WebSocket Configuration Constants
export const WEBSOCKET_CONFIG = {
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 300000, // 5 minutes
  RATE_LIMIT: {
    MAX_MESSAGES: 60, // Max messages per minute
    WINDOW_MS: 60000, // 1 minute
    BLOCK_DURATION: 300000 // 5 minutes
  },
  REDIS_RECONNECT: {
    MAX_ATTEMPTS: 10,
    RETRY_DELAY: 1000
  },
  MESSAGE_QUEUE: {
    MAX_SIZE: 100, // Max queued messages per client
    TTL: 86400 // 24 hours
  }
};

// Redis Configuration Constants
export const REDIS_CONFIG = {
  DEFAULT_URL: 'redis://localhost:6379',
  RECONNECT_ATTEMPTS: 10,
  RETRY_DELAY: 1000,
  CONNECT_TIMEOUT: 10000,
  MAX_RETRIES_PER_REQUEST: 3
};