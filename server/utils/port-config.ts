/**
 * Port configuration utility
 * Ensures proper port binding for cloud deployments
 */

export function getPort(): number {
  // Always prefer PORT from environment (required by Render, Heroku, etc.)
  const envPort = process.env.PORT;
  
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      console.log(`Using PORT from environment: ${port}`);
      return port;
    }
  }
  
  // Fallback to defaults
  const defaultPort = process.env.NODE_ENV === 'development' ? 5000 : 3000;
  console.log(`Using default PORT: ${defaultPort}`);
  return defaultPort;
}

export function getHost(): string {
  // Always bind to 0.0.0.0 in production for container/cloud compatibility
  const host = process.env.HOST || '0.0.0.0';
  console.log(`Using HOST: ${host}`);
  return host;
}