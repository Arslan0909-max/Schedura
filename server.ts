import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './server/api';
import { setupLiveWebSocket } from './server/liveApi';
dotenv.config();

const app = express();
const PORT = 3000;

// Mount the API router directly at both /api/* and root API paths.
// This avoids an extra Express application layer interfering with Vercel routing.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiRouter);
app.use(apiRouter);

// Health check endpoints
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve static frontend in production
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = http.createServer(app);

// Vercel serverless functions do not provide a persistent WebSocket server.
// Keep the local/self-hosted Live WebSocket implementation outside Vercel.
if (!process.env.VERCEL) {
  setupLiveWebSocket(server);

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Schedura server running on port ${PORT}`);
  });
}

export default app;
