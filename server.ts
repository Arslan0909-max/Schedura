import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { apiApp } from './server/api.ts';
import { setupLiveWebSocket } from './server/liveApi.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(apiApp);

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
setupLiveWebSocket(server);

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Schedura server running on port ${PORT}`);
  });
}

export default app;
