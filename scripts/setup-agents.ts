import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHARACTERS as GAME_CHARACTERS, CHARACTER_TOOLS, getCharacterPrompt, getOpeners } from '../src/characters.js';
import type { ToolName } from '../src/characters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.env.ALEBEX_API_URL || 'https://api.alebex.ai/api/v1';
const API_KEY = process.env.ALEBEX_API_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const TOOL_SECRET = process.env.TOOL_SHARED_SECRET || '';

// Prompts, openers and tool lists live in src/characters.ts, shared with the game,
// so the live agents and the demo dialogue never drift apart.
interface AgentSpec {
  id: string;
  name: string;
  prompt: string;
  /** the provider speaks one fixed first line; the game rotates openers in demo mode */
  firstMessage: string;
  tools: ToolName[];
}

const CHARACTERS: AgentSpec[] = GAME_CHARACTERS.map((c) => ({
  id: c.id,
  name: c.name,
  prompt: getCharacterPrompt(c),
  firstMessage: getOpeners(c)[0],
  tools: CHARACTER_TOOLS[c.archetype],
}));

async function alebexRequest(method: string, path: string, body?: any) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const code = error.error?.code ? `${error.error.code}: ` : '';
    throw new Error(`${response.status}: ${code}${error.error?.message || error.detail || 'Request failed'}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Distinct voice per coworker, resolved by name from GET /public/voices at run time.
// Falls back to the account default voice if a name is not in the list.
const VOICE_NAMES: Record<string, string> = {
  flatterer: 'Greg',
  jealous: 'Natalie',
  overconfident: 'Grant',
  burnout: 'Tessa',
  mentor: 'Rowan',
  gossip: 'Kayla',
};

async function listAllAgents(): Promise<any[]> {
  // GET /public/agents is paginated ({ items, nextCursor }, default 25 per page).
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const qs: string = cursor ? `?limit=100&cursor=${encodeURIComponent(cursor)}` : '?limit=100';
    const page: any = await alebexRequest('GET', `/public/agents${qs}`);
    all.push(...(page.items || []));
    cursor = page.nextCursor || null;
  } while (cursor);
  return all;
}

function toolDefinitions() {
  if (!PUBLIC_BASE_URL) return [];
  const headers = TOOL_SECRET ? { 'Authorization': `Bearer ${TOOL_SECRET}` } : {};
  return [
    {
      name: 'check_player',
      description: 'Check how the player is doing right now: energy, stress, reputation, performance, hours worked today, hours until the Friday review, whether they are on track for promotion or already promoted, plus a short summary in words. Call it before your second line and after they answer an ask.',
      url: `${PUBLIC_BASE_URL}/tools/check_player`,
      headers,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'make_offer',
      description: 'Present an offer or request to the player. Use this when suggesting extra work, overtime, weekend tasks, or any request that affects their workload or time.',
      url: `${PUBLIC_BASE_URL}/tools/make_offer`,
      headers,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the offer' },
          description: { type: 'string', description: 'What you\'re asking them to do' },
          workload: { type: 'integer', description: 'How much work it is, one to ten' },
          intent: { type: 'string', description: 'Your honest intent: helpful, manipulative, or neutral' },
        },
        required: ['title', 'description'],
      },
    },
  ];
}

// Agents don't take inline customTools: tools are stored once (/public/tools) and attached by toolIds.
async function upsertTools(): Promise<Record<string, string>> {
  const defs = toolDefinitions();
  if (defs.length === 0) return {};
  const { items } = await alebexRequest('GET', '/public/tools');
  const ids: Record<string, string> = {};
  for (const def of defs) {
    const existing = (items || []).find((t: any) => t.name === def.name);
    const tool = existing
      ? await alebexRequest('PATCH', `/public/tools/${existing.id}`, def)
      : await alebexRequest('POST', '/public/tools', def);
    console.log(`${existing ? 'Updated' : 'Created'} tool ${def.name}: ${tool.id}`);
    ids[def.name] = tool.id;
  }
  return ids;
}

async function getOrCreateAgent(character: AgentSpec, existingAgents: any[], toolIds: Record<string, string>, voices: any[]) {
  const existing = existingAgents.find((a: any) => a.name === character.name);

  const voiceName = VOICE_NAMES[character.id];
  const voice = voices.find((v: any) => v.name === voiceName && v.language === 'en');

  const agentData: Record<string, any> = {
    name: character.name,
    prompt: character.prompt,
    firstMessage: character.firstMessage,
    behaviour: {
      turnEnd: 'fast',
      // lets the agent hang up after its closing line (see ENDING THE CONVERSATION in the prompts)
      allowEndCall: true,
      callEvents: false,
      backgroundVolume: 0.3,
      callLimitMinutes: 5,
    },
    // every coworker gets the tools listed for them in CHARACTER_TOOLS (check_player for all six)
    toolIds: character.tools.map((t) => toolIds[t]).filter(Boolean),
  };
  if (voice) {
    agentData.voices = [{ voiceId: voice.voiceId, language: 'en' }];
  } else if (voiceName) {
    console.warn(`Voice "${voiceName}" not found, using the account default for ${character.name}`);
  }

  if (existing) {
    console.log(`Updating existing agent: ${character.name}`);
    const updated = await alebexRequest('PATCH', `/public/agents/${existing.id}`, agentData);
    return updated;
  } else {
    console.log(`Creating new agent: ${character.name}`);
    const created = await alebexRequest('POST', '/public/agents', agentData);
    return created;
  }
}

async function main() {
  if (!API_KEY) {
    console.error('Error: ALEBEX_API_KEY not set');
    console.log('Set your API key in .env to create voice agents');
    process.exit(1);
  }

  console.log('Setting up Alebex voice agents...\n');

  const configPath = path.join(__dirname, '../agents-config.json');
  // Keep ids from a previous run if this one fails part-way.
  let config: Record<string, string> = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {}

  const existingAgents = await listAllAgents();
  const toolIds = await upsertTools();
  const voices = await alebexRequest('GET', '/public/voices').catch(() => []);
  let failures = 0;

  for (const character of CHARACTERS) {
    try {
      const agent = await getOrCreateAgent(character, existingAgents, toolIds, voices);
      config[character.id] = agent.id;
      console.log(`✓ ${character.name}: ${agent.id}\n`);
    } catch (error: any) {
      console.error(`✗ Failed to setup ${character.name}:`, error.message);
      failures++;
    }
  }

  // Save config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\nAgent configuration saved to: ${configPath}`);
  
  if (!PUBLIC_BASE_URL) {
    console.log('\nNote: PUBLIC_BASE_URL not set, agents created without tools.');
    console.log('Tools require a public HTTPS URL (use Tailscale Funnel or ngrok).');
  }

  if (failures > 0) {
    console.error(`\n${failures} agent(s) failed to set up.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
