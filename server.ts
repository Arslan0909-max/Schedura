import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiApp } from './server/api.ts';
import { setupLiveWebSocket } from './server/liveApi.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(apiApp);

// Serve static frontend in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = http.createServer(app);
setupLiveWebSocket(server);

server.listen(PORT, () => {
  console.log(`Schedura server with Gemini 3.1 Flash Live running on port ${PORT}`);
});
