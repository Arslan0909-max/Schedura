import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './server/api';
import { setupLiveWebSocket } from './server/liveApi';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API router is mounted both ways so /api/chat, /api/tts and /chat remain compatible.
app.use('/api', apiRouter);
app.use(apiRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'schedura-api', geminiConfigured: Boolean(process.env.GEMINI_API_KEY) }));

// Secure short-lived Gemini Live token. The Gemini API key never reaches the browser.
app.get('/api/live-token', async (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authToken: {
          uses: 1,
          expireTime,
          newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
          bidiGenerateContentSetup: {
            model: 'models/gemini-3.1-flash-live-preview',
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini Live token error:', data);
      return res.status(response.status).json({ error: data?.error?.message || 'Unable to create Live token.' });
    }

    return res.json({ token: data.name, expiresAt: data.expireTime || expireTime });
  } catch (error: any) {
    console.error('Live token endpoint error:', error?.message || error);
    return res.status(500).json({ error: 'Unable to initialize Gemini Live.' });
  }
});

const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = http.createServer(app);

// Vercel functions are ephemeral and cannot host a persistent WebSocket server.
// Local/self-hosted deployments can still use the original WebSocket implementation.
if (!process.env.VERCEL) {
  setupLiveWebSocket(server);
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Schedura server running on port ${PORT}`);
  });
}

export default app;
