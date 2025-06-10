import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Server</title>
    </head>
    <body>
      <h1>Server is Working!</h1>
      <p>If you can see this, the server is running correctly.</p>
      <p>Time: ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
});

const port = 3000;
server.listen(port, '127.0.0.1', () => {
  console.log(`Test server running at http://127.0.0.1:${port}/`);
  console.log(`Also try: http://localhost:${port}/`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});