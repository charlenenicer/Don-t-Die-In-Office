import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { WALK_AWAY_GRACE_S, WALK_AWAY_RANGE, WalkAwayTimer, drainDelayMs, isWindingDown, speechMs, MAX_DRAIN_MS } from '../src/call-ending';
import { CHARACTERS, PERSONAS } from '../src/characters';
import { GameEngine } from '../src/game-engine';
import { describePlayer, numberWords, playerSnapshot } from '../src/player-snapshot';
import { CallStore, setupToolEndpoints } from '../server/tools';

describe('winding down', () => {
  it.each(['Gotta go', 'ok I have to get back to my desk', 'bye', 'Alright, see you', 'Thanks, bye.', 'I should get going', 'talk later'])('hears "%s" as a goodbye', (line) => {
    expect(isWindingDown(line)).toBe(true);
  });
  it.each(['What do you need?', 'I can go over the deck', 'No, I can\'t do Saturday', 'Tell me more', 'sure'])('doesn\'t hear "%s" as a goodbye', (line) => {
    expect(isWindingDown(line)).toBe(false);
  });
});

describe('timing', () => {
  it('waits for queued audio to finish before hanging up, capped', () => {
    expect(drainDelayMs(10, 10)).toBe(0);
    expect(drainDelayMs(12.5, 10)).toBe(2750);
    expect(drainDelayMs(100, 10)).toBe(MAX_DRAIN_MS);
  });
  it('gives demo captions time to be read', () => {
    expect(speechMs('Bye.')).toBe(1200);
    expect(speechMs('Oh shoot, that\'s my four o\'clock, I have to jump. You\'re amazing, seriously.')).toBeGreaterThan(3000);
  });
  it('ends a conversation once the player has walked out of range for the grace period, only once', () => {
    const t = new WalkAwayTimer();
    expect(t.update(WALK_AWAY_RANGE - 1, 1)).toBe(false);
    let fired = 0;
    for (let i = 0; i < 60; i++) if (t.update(WALK_AWAY_RANGE + 1, 1 / 60)) fired++;
    expect(fired).toBe(1);
    t.reset();
    // stepping back in range resets it
    for (let i = 0; i < Math.floor((WALK_AWAY_GRACE_S * 60) / 2); i++) t.update(WALK_AWAY_RANGE + 1, 1 / 60);
    expect(t.update(WALK_AWAY_RANGE - 1, 1 / 60)).toBe(false);
    for (let i = 0; i < Math.floor((WALK_AWAY_GRACE_S * 60) / 2); i++) expect(t.update(WALK_AWAY_RANGE + 1, 1 / 60)).toBe(false);
  });
});

describe('player snapshot for check_player', () => {
  it('speaks numbers as words and covers stress, hours and promotion', () => {
    const engine = new GameEngine();
    const state = engine.getState();
    state.stats.energy = 32;
    state.stats.burnout = 71;
    state.dayTime = 15;
    const s = playerSnapshot(state, false);
    expect(s.stress).toBe(71);
    expect(s.hoursWorkedToday).toBe(6);
    expect(s.summary).toMatch(/Energy is low, about thirty out of a hundred/);
    expect(s.summary).toMatch(/stress is high, about seventy/);
    expect(s.summary).toMatch(/worked six hours today/);
    expect(s.summary).toMatch(/not on track for a promotion/);
    expect(s.summary).not.toMatch(/\d/);
    expect(describePlayer({ ...s, promoted: true })).toMatch(/promoted this week/);
    expect(numberWords(45)).toBe('forty-five');
    expect(numberWords(100)).toBe('a hundred');
  });
});

describe('tool endpoints', () => {
  const app = () => {
    const a = express();
    a.use(express.json());
    const store = new CallStore();
    setupToolEndpoints(a, store);
    return a;
  };
  const snap = playerSnapshot(new GameEngine().getState(), false);

  it('check_player returns what the game reported, matched by call id or agent id', async () => {
    const a = app();
    await request(a).post('/api/call/state').send({ agentId: 'agt_marcus', snapshot: { ...snap, energy: 22, summary: 'Tired.' } }).expect(204);
    const byAgent = await request(a).post('/tools/check_player').send({ tool: 'check_player', arguments: {}, call: { id: 'unknown', agentId: 'agt_marcus' } }).expect(200);
    expect(byAgent.body.energy).toBe(22);
    expect(byAgent.body.summary).toBe('Tired.');
    await request(a).post('/api/call/state').send({ callId: 'c1', agentId: 'agt_james', snapshot: { ...snap, stress: 80 } }).expect(204);
    const byCall = await request(a).post('/tools/check_player').send({ call: { id: 'c1', agentId: 'x' } }).expect(200);
    expect(byCall.body.stress).toBe(80);
    expect(byCall.body).toHaveProperty('hoursWorkedToday');
    expect(byCall.body).toHaveProperty('onTrackForPromotion');
  });

  it('rejects junk state', async () => {
    await request(app()).post('/api/call/state').send({ snapshot: { energy: 'lots' } }).expect(400);
  });

  it('make_offer reaches the game exactly once', async () => {
    const a = app();
    await request(a).post('/tools/make_offer').send({ arguments: { title: 'Saturday deck', description: 'Just a few hours' }, call: { id: 'c9', agentId: 'agt_marcus' } }).expect(200);
    const first = await request(a).get('/api/call/events').query({ agentId: 'agt_marcus', callId: 'c9' }).expect(200);
    expect(first.body.offers.map((o: any) => o.title)).toEqual(['Saturday deck']);
    const again = await request(a).get('/api/call/events').query({ agentId: 'agt_marcus' }).expect(200);
    expect(again.body.offers).toEqual([]);
  });
});

describe('demo conversation (simulated voice client)', () => {
  const events: { type: string; detail: any }[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    events.length = 0;
    const win = {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
      dispatchEvent: (e: any) => { events.push({ type: e.type, detail: e.detail }); return true; },
      location: { protocol: 'http:', host: 'localhost' },
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('CustomEvent', class { type: string; detail: any; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ available: false, agents: {} }) })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const lines = () => events.filter((e) => e.type === 'transcript').map((e) => e.detail.text as string);

  it('opens, asks, closes in character, then hangs up after the closing line', async () => {
    const { VoiceClient } = await import('../src/voice-client');
    const engine = new GameEngine();
    const client = new VoiceClient(engine);
    const marcus = CHARACTERS[0];
    await client.startCall(marcus);
    expect(client.isActive()).toBe(true);
    expect(PERSONAS.flatterer.openers).toContain(lines()[0]);
    await vi.advanceTimersByTimeAsync(8000);
    expect(engine.getState().activeChoice?.characterId).toBe('flatterer');
    const closer = lines().at(-1)!;
    expect(PERSONAS.flatterer.closers['wrap-up']).toContain(closer);
    // still on the call while the closing line is being said...
    expect(client.isActive()).toBe(true);
    expect(client.isEnding()).toBe(true);
    // ...and off it once it has been
    await vi.advanceTimersByTimeAsync(speechMs(closer));
    expect(client.isActive()).toBe(false);
    expect(lines().join(' ').toLowerCase()).not.toMatch(/end call|hang/);
  });

  it('walking away gets a short farewell, then the call ends; E again hangs up at once', async () => {
    const { VoiceClient } = await import('../src/voice-client');
    const client = new VoiceClient(new GameEngine());
    const james = CHARACTERS.find((c) => c.id === 'mentor')!;
    await client.startCall(james);
    client.hangUp('walk-away');
    const farewell = lines().at(-1)!;
    expect(PERSONAS.mentor.closers['walk-away']).toContain(farewell);
    expect(client.isActive()).toBe(true);
    await vi.advanceTimersByTimeAsync(speechMs(farewell));
    expect(client.isActive()).toBe(false);
    // no stray offer or closing line after the call ended
    const n = lines().length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(lines().length).toBe(n);

    await client.startCall(james);
    client.hangUp('walk-away');
    client.hangUp('walk-away');
    expect(client.isActive()).toBe(false);
  });
});

describe('live call ending (fake socket and audio)', () => {
  let sockets: any[] = [];
  let t0 = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    t0 = Date.now();
    const win = {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
      dispatchEvent: () => true,
      location: { protocol: 'http:', host: 'localhost' },
    };
    class FakeWS {
      static OPEN = 1;
      readyState = 1;
      sent: any[] = [];
      onopen: any; onmessage: any; onclose: any; onerror: any;
      constructor() { sockets.push(this); }
      send(d: any) { this.sent.push(d); }
      close() { this.readyState = 3; this.onclose?.(); }
    }
    class FakeAudio {
      sampleRate = 48000;
      destination = {};
      get currentTime() { return (Date.now() - t0) / 1000; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createBuffer(_c: number, len: number, rate: number) { return { duration: len / rate, getChannelData: () => ({ set() {} }) }; }
      createBufferSource() {
        const src: any = { connect() {}, stop() {}, onended: null, start: (at: number) => { setTimeout(() => src.onended?.(), (at - this.currentTime + src.buffer.duration) * 1000); } };
        return src;
      }
      createMediaStreamSource() { return { connect() {} }; }
      createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null }; }
    }
    vi.stubGlobal('window', win);
    vi.stubGlobal('WebSocket', FakeWS);
    vi.stubGlobal('AudioContext', FakeAudio);
    vi.stubGlobal('CustomEvent', class { type: string; detail: any; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes('status') ? { available: true, agents: { flatterer: 'agt_marcus' } } : { offers: [] }) })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const say = (ws: any, text: string, seconds: number) => {
    ws.onmessage({ data: JSON.stringify({ type: 'conversation_message', role: 'assistant', content: text }) });
    const bytes = Buffer.alloc(Math.round(seconds * 24000) * 2).toString('base64');
    ws.onmessage({ data: JSON.stringify({ type: 'audio', data: bytes, format: 'pcm16', sample_rate: 24000 }) });
  };
  const start = async () => {
    const { VoiceClient } = await import('../src/voice-client');
    const engine = new GameEngine();
    const client = new VoiceClient(engine);
    await client.startCall(CHARACTERS[0]);
    const ws = sockets[0];
    ws.onopen();
    return { client, ws, engine };
  };

  it('reports the player to check_player when the call starts', async () => {
    const { ws } = await start();
    ws.onmessage({ data: JSON.stringify({ type: 'call_started', call_id: 'c42' }) });
    const posts = (fetch as any).mock.calls.filter(([u]: [string]) => u === '/api/call/state').map(([, o]: any) => JSON.parse(o.body));
    expect(posts.at(-1)).toMatchObject({ callId: 'c42', agentId: 'agt_marcus' });
    expect(posts.at(-1).snapshot.summary).toMatch(/Energy is/);
    const startFrame = JSON.parse(ws.sent.find((d: any) => typeof d === 'string' && d.includes('start_call')));
    expect(startFrame.context).toMatch(/How they seem: Energy is/);
  });

  it('when the agent hangs up, its closing line plays to the end first', async () => {
    const { client, ws } = await start();
    say(ws, 'Oh shoot, that\'s my four o\'clock, I have to jump.', 3);
    ws.onmessage({ data: JSON.stringify({ type: 'call_ended', reason: 'agent' }) });
    expect(client.isActive()).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(client.isActive()).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(client.isActive()).toBe(false);
  });

  it('if the player says goodbye and the agent answers but doesn\'t hang up, the game does after a short silence', async () => {
    const { client, ws } = await start();
    ws.onmessage({ data: JSON.stringify({ type: 'conversation_message', role: 'user', content: 'Sorry, gotta go.' }) });
    say(ws, 'Totally, I\'ll ping you.', 1.5);
    await vi.advanceTimersByTimeAsync(1500);
    expect(client.isActive()).toBe(true);
    await vi.advanceTimersByTimeAsync(3500);
    expect(client.isActive()).toBe(false);
    expect(ws.sent.some((d: any) => typeof d === 'string' && d.includes('end_call'))).toBe(true);
  });

  it('walking away mid-sentence lets the sentence finish before the farewell and hang-up', async () => {
    const { client, ws } = await start();
    say(ws, 'Okay so, the launch deck, I really need someone like you on it.', 4);
    client.hangUp('walk-away');
    await vi.advanceTimersByTimeAsync(3800);
    expect(ws.sent.some((d: any) => typeof d === 'string' && d.includes('end_call'))).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(client.isActive()).toBe(false);
    expect(ws.sent.some((d: any) => typeof d === 'string' && d.includes('end_call'))).toBe(true);
  });
});
