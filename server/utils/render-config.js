// Render.com specific configuration
export function getRenderPort() {
  // Render sets PORT environment variable
  const port = parseInt(process.env.PORT || '10000', 10);
  console.log(`Render PORT detected: ${port}`);
  return port;
}

export function getRenderHost() {
  // Must bind to 0.0.0.0 for Render
  return '0.0.0.0';
}