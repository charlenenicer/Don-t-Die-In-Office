import type { Express, Request, Response } from 'express';

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

export function setupToolEndpoints(app: Express) {
  // Store for game state per call
  const callStates = new Map<string, any>();

  // Check player state tool
  app.post('/tools/check_player', async (req: Request, res: Response) => {
    if (!verifyToolAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { call } = req.body as ToolRequest;
    const state = callStates.get(call.id) || {};

    // Return speakable game state
    res.json({
      energy: state.energy || 80,
      reputation: state.reputation || 50,
      performance: state.performance || 50,
      burnout: state.burnout || 0,
      level: state.level || 'junior',
      wasPromoted: state.wasPromoted || false,
      summary: buildStateSummary(state),
    });
  });

  // Make offer tool
  app.post('/tools/make_offer', async (req: Request, res: Response) => {
    if (!verifyToolAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { arguments: args, call } = req.body as ToolRequest;

    // Validate offer
    if (!args.title || !args.description) {
      return res.status(400).json({ 
        error: 'Offer requires title and description' 
      });
    }

    // Store the offer for the client to retrieve
    // In a real app, this would go through a database or message queue
    callStates.set(`${call.id}_offer`, {
      title: args.title,
      description: args.description,
      workload: args.workload || 5,
      intent: args.intent || 'neutral',
      timestamp: Date.now(),
    });

    res.json({
      offered: true,
      message: 'The offer has been presented to the player',
    });
  });
}

function verifyToolAuth(req: Request): boolean {
  // Check Authorization header
  const authHeader = req.get('authorization');
  if (!authHeader) return !TOOL_SECRET; // Allow if no secret configured (demo mode)

  return authHeader === `Bearer ${TOOL_SECRET}`;
}

function buildStateSummary(state: any): string {
  const parts = [];
  
  if (state.energy < 40) parts.push('looks tired');
  else if (state.energy > 80) parts.push('energetic');
  
  if (state.burnout > 60) parts.push('showing signs of burnout');
  if (state.reputation > 70) parts.push('well regarded');
  else if (state.reputation < 30) parts.push('reputation needs work');
  
  if (state.performance > 70) parts.push('performing well');
  
  if (state.wasPromoted) parts.push('recently promoted');

  return parts.length > 0 
    ? `They ${parts.join(', ')}.`
    : 'They seem to be doing okay.';
}
