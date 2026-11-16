import type { Express, Request, Response } from 'express';
import { UNKNOWN_PLAYER } from '../src/player-snapshot.js';
import type { PlayerSnapshot } from '../src/player-snapshot.js';

const TOOL_SECRET = process.env.TOOL_SHARED_SECRET || '';

interface ToolRequest {
  tool: string;
  arguments: Record<string, any>;
  call: {
    id: string;
    agentId: string;
    from: string;
    to: string;
    startedAt: string;
  };
}

export interface OfferEvent {
  title: string;
  description: string;
  workload: number;
  intent: string;
  timestamp: number;
}

/**
 * Per-call state shared between the game (which reports the player's state and
 * collects offers) and the voice agents' tools (which read it and post offers).
 * A tool call is matched to the game by call id, then by agent id (one game talks
 * to one agent at a time), then falls back to the most recent report.
 */
export class CallStore {
  private snapshots = new Map<string, PlayerSnapshot>();
  private latest: PlayerSnapshot | null = null;
  private offers = new Map<string, OfferEvent[]>();

  private keys(callId?: string, agentId?: string): string[] {
    return [callId && `call:${callId}`, agentId && `agent:${agentId}`].filter(Boolean) as string[];
  }

  report(snapshot: PlayerSnapshot, callId?: string, agentId?: string) {
    for (const k of this.keys(callId, agentId)) this.snapshots.set(k, snapshot);
    this.latest = snapshot;
  }

  player(callId?: string, agentId?: string): PlayerSnapshot {
    for (const k of this.keys(callId, agentId)) {
      const s = this.snapshots.get(k);
      if (s) return s;
    }
    return this.latest ?? UNKNOWN_PLAYER;
  }

  addOffer(offer: OfferEvent, callId?: string, agentId?: string) {
    // queue under the agent id (always known on both sides); the call id is kept for the lookup below
    const key = agentId ? `agent:${agentId}` : `call:${callId}`;
    this.offers.set(key, [...(this.offers.get(key) ?? []), offer]);
  }

  takeOffers(callId?: string, agentId?: string): OfferEvent[] {
    const out: OfferEvent[] = [];
    for (const k of this.keys(callId, agentId)) {
      out.push(...(this.offers.get(k) ?? []));
      this.offers.delete(k);
    }
    return out;
  }
}

const isSnapshot = (s: any): s is PlayerSnapshot =>
  s && typeof s === 'object' && ['energy', 'stress', 'reputation', 'performance'].every((k) => typeof s[k] === 'number') && typeof s.summary === 'string';

export function setupToolEndpoints(app: Express, store = new CallStore()) {
  // The game reports the player's state when a call starts and whenever it changes
  app.post('/api/call/state', (req: Request, res: Response) => {
    const { callId, agentId, snapshot } = req.body ?? {};
    if (!isSnapshot(snapshot) || String(snapshot.summary).length > 600) return res.status(400).json({ error: 'Invalid snapshot' });
    store.report(snapshot, typeof callId === 'string' ? callId : undefined, typeof agentId === 'string' ? agentId : undefined);
    res.sendStatus(204);
  });

  // ...and collects any offers the agent made with make_offer
  app.get('/api/call/events', (req: Request, res: Response) => {
    const callId = typeof req.query.callId === 'string' ? req.query.callId : undefined;
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
    res.json({ offers: store.takeOffers(callId, agentId) });
  });

  // Check player state tool: every coworker has it (see CHARACTER_TOOLS)
  app.post('/tools/check_player', async (req: Request, res: Response) => {
    if (!verifyToolAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { call } = (req.body ?? {}) as ToolRequest;
    const s = store.player(call?.id, call?.agentId);
    res.json({
      energy: s.energy,
      stress: s.stress,
      reputation: s.reputation,
      performance: s.performance,
      hoursWorkedToday: s.hoursWorkedToday,
      hoursUntilReview: s.hoursUntilReview,
      day: s.day,
      level: s.level,
      onTrackForPromotion: s.onTrackForPromotion,
      wasPromoted: s.promoted,
      summary: s.summary,
    });
  });

  // Make offer tool: queued for the game, which shows the Accept / Decline card
  app.post('/tools/make_offer', async (req: Request, res: Response) => {
    if (!verifyToolAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { arguments: args, call } = (req.body ?? {}) as ToolRequest;
    if (!args?.title || !args?.description) {
      return res.status(400).json({ error: 'Offer requires title and description' });
    }
    store.addOffer({
      title: String(args.title).slice(0, 80),
      description: String(args.description).slice(0, 300),
      workload: Number.isFinite(args.workload) ? args.workload : 5,
      intent: typeof args.intent === 'string' ? args.intent : 'neutral',
      timestamp: Date.now(),
    }, call?.id, call?.agentId);
    res.json({ offered: true, message: 'The offer is on their screen now. Wait for their answer.' });
  });
}

function verifyToolAuth(req: Request): boolean {
  const authHeader = req.get('authorization');
  if (!authHeader) return !TOOL_SECRET; // Allow if no secret configured (demo mode)
  return authHeader === `Bearer ${TOOL_SECRET}`;
}
