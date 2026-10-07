import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupVoiceProxy } from './voice-proxy.js';
import { setupToolEndpoints } from './tools.js';
import { setupWebhook } from './webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = parseInt(process.env.PORT || '3456', 10);
const API_KEY = process.env.ALEBEX_API_KEY || '';

// Webhook raw body parser (must come before express.json())
setupWebhook(app);

// Middleware for other routes
app.use(express.json({ limit: '2mb' }));

// Agent ids written by `npm run setup-agents` (character id -> Alebex agent id).
// Agent ids are not secret; the API key never leaves the server.
const AGENTS_CONFIG = path.join(__dirname, '../agents-config.json');
function loadAgentIds(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(AGENTS_CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

// Voice status endpoint: voice mode needs the key and at least one agent id
app.get('/api/voice/status', (req, res) => {
  const agents = API_KEY ? loadAgentIds() : {};
  res.json({ available: !!API_KEY && Object.keys(agents).length > 0, agents });
});

// Setup tool endpoints
setupToolEndpoints(app);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // vite builds the client to dist/client (see vite.config.ts)
  const clientDir = path.join(__dirname, '../dist/client');
  app.use(express.static(clientDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws/call')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      setupVoiceProxy(ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Voice mode: ${API_KEY ? 'enabled' : 'disabled (demo mode)'}`);
});
