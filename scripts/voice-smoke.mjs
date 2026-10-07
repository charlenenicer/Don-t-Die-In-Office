// Voice smoke test: connects to this server's browser-call proxy (/ws/call), like the client does.
// Usage: node scripts/voice-smoke.mjs [baseUrl] [characterId]
import WebSocket from 'ws';

const base = process.argv[2] || 'http://127.0.0.1:8050';
const characterId = process.argv[3] || 'mentor';
const LIMIT_MS = 10000;

const status = await (await fetch(`${base}/api/voice/status`)).json();
console.log('status.available =', status.available);
const agentId = status.agents?.[characterId];
if (!status.available || !agentId) { console.log('FAIL: voice not available or no agent for', characterId); process.exit(1); }

const wsUrl = base.replace(/^http/, 'ws') + '/ws/call';
const t0 = Date.now();
const ms = () => `${Date.now() - t0}ms`;
const ws = new WebSocket(wsUrl);
let callStarted = false, audio = false, ended = false, audioFrames = 0;
const seen = {};

const timer = setTimeout(() => { console.log(`[${ms()}] timeout, ending`); finish(); }, LIMIT_MS);

function finish() {
  if (ended) return; ended = true;
  clearTimeout(timer);
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'end_call' }));
  setTimeout(() => {
    try { ws.close(); } catch {}
    console.log('frame types seen:', JSON.stringify(seen));
    console.log(`RESULT call_started=${callStarted} audio=${audio}`);
    process.exit(callStarted && audio ? 0 : 2);
  }, 1500);
}

ws.on('open', () => {
  console.log(`[${ms()}] proxy socket open, sending start_call for ${characterId} (${agentId})`);
  ws.send(JSON.stringify({ type: 'start_call', agent: { id: agentId }, context: 'Day 1, 9:00. Smoke test.' }));
});
ws.on('message', (data, isBinary) => {
  if (isBinary) { seen.binary = (seen.binary || 0) + 1; return; }
  let f; try { f = JSON.parse(data.toString()); } catch { console.log('non-JSON text frame'); return; }
  seen[f.type] = (seen[f.type] || 0) + 1;
  if (f.type === 'audio') {
    audioFrames++;
    if (!audio) { audio = true; console.log(`[${ms()}] first audio: format=${f.format} sample_rate=${f.sample_rate} bytes=${Buffer.from(f.data || '', 'base64').length}`); finish(); }
    return;
  }
  const preview = JSON.stringify(f).slice(0, 300);
  console.log(`[${ms()}] ${f.type}: ${preview}`);
  if (f.type === 'call_started') callStarted = true;
  if (f.type === 'error' || f.type === 'call_ended') finish();
});
ws.on('close', (code, reason) => { console.log(`[${ms()}] socket closed ${code} ${reason}`); if (!ended) finish(); });
ws.on('error', (e) => { console.log(`[${ms()}] socket error ${e.message}`); });
