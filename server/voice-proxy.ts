import WebSocket from 'ws';

const ENGINE_URL = process.env.ALEBEX_ENGINE_URL || 'https://api.voice.alebex.ai';
const API_KEY = process.env.ALEBEX_API_KEY || '';

// Close codes a server may not send itself (1005/1006/1015 are reserved for local use).
function safeCloseCode(code: number): number {
  return code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 && code !== 1015 ? code : 1011;
}

export function setupVoiceProxy(clientWs: WebSocket) {
  if (!API_KEY) {
    clientWs.close(1008, 'Voice mode not configured');
    return;
  }

  // Connect to Alebex engine. The key travels as the `alebex.token.<key>` subprotocol;
  // passing it as `protocols` (not a raw header) lets ws accept the engine echoing it back.
  const engineWs = new WebSocket(
    `${ENGINE_URL.replace(/^http/, 'ws')}/public/ws/call`,
    [`alebex.token.${API_KEY}`],
  );

  // The browser sends start_call as soon as its socket opens, usually before the engine
  // socket is up. Queue until then instead of dropping it.
  const pending: Array<{ data: WebSocket.RawData; isBinary: boolean }> = [];

  engineWs.on('open', () => {
    for (const { data, isBinary } of pending.splice(0)) {
      engineWs.send(data, { binary: isBinary });
    }
  });

  // Forward from client to engine
  clientWs.on('message', (data, isBinary) => {
    if (engineWs.readyState === WebSocket.OPEN) {
      engineWs.send(data, { binary: isBinary });
    } else if (engineWs.readyState === WebSocket.CONNECTING) {
      pending.push({ data, isBinary });
    }
  });

  // Forward from engine to client (keep text frames as text so the browser gets strings)
  engineWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  // Handle close
  clientWs.on('close', () => {
    if (engineWs.readyState === WebSocket.OPEN || engineWs.readyState === WebSocket.CONNECTING) {
      engineWs.close();
    }
  });

  engineWs.on('close', (code, reason) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(safeCloseCode(code), reason.toString().slice(0, 120));
    }
  });

  // Handle errors (log the message only, never request details)
  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error.message);
    engineWs.close();
  });

  engineWs.on('error', (error) => {
    console.error('Engine WebSocket error:', error.message);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, 'Voice engine unavailable');
  });
}
