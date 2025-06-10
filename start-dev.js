import express from 'express';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  const app = express();
  
  // Create Vite server
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: join(__dirname, 'client'),
  });
  
  // Use vite's connect instance as middleware
  app.use(vite.middlewares);
  
  const port = process.env.PORT || 3000;
  
  app.listen(port, () => {
    console.log(`✨ Development server running at http://localhost:${port}`);
    console.log(`🚀 Open your browser to http://localhost:${port}`);
  });
}

startServer().catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});