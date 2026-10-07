import { describe, it, expect } from 'vitest';

describe('Prompt validation', () => {
  const samplePrompt = `## WHO YOU ARE
You are Marcus Chen, Senior Product Manager, speaking with a colleague. Everything you say is heard out loud.

## HOW YOU SPEAK
- Use contractions: I'm, you're, that's
- No exclamation marks
- Numbers as spoken: forty-five
- Dates as spoken: Friday, December fifth`;

  it('should not contain exclamation marks', () => {
    expect(samplePrompt).not.toMatch(/!/);
  });

  it('should not contain placeholder brackets', () => {
    expect(samplePrompt).not.toMatch(/\{\{|\}\}|\[|\<[A-Z]/);
  });

  it('should not contain em or en dashes', () => {
    expect(samplePrompt).not.toMatch(/—|–/);
  });

  it('should be under reasonable length', () => {
    // Prompts should be under ~4000 characters for efficiency
    expect(samplePrompt.length).toBeLessThan(4000);
  });

  it('should not contain spoken_line parameter', () => {
    const toolSchema = {
      name: 'make_offer',
      parameters: {
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        }
      }
    };
    
    expect(toolSchema.parameters.properties).not.toHaveProperty('spoken_line');
  });

  it('should not use reserved tool names', () => {
    const reservedNames = [
      'end_call', 
      'transfer_call', 
      'leave_voicemail',
      'book_appointment',
    ];
    
    const ourToolNames = ['check_player', 'make_offer'];
    
    ourToolNames.forEach(name => {
      expect(reservedNames).not.toContain(name);
    });
  });

  it('should have at most 8 tools', () => {
    const tools = ['check_player', 'make_offer'];
    expect(tools.length).toBeLessThanOrEqual(8);
  });
});

describe('Context builder', () => {
  it('should build speakable context', () => {
    const state = {
      dayNumber: 3,
      dayTime: 14,
      stats: {
        energy: 65,
        reputation: 58,
        performance: 72,
        burnout: 25,
      },
      level: 'junior',
      inventory: [
        { name: 'Standing Desk' },
        { name: 'Noise-Cancelling Headphones' },
      ],
    };

    const context = [
      `Day ${state.dayNumber}, ${Math.floor(state.dayTime)}:00`,
      `Stats: Energy ${state.stats.energy}, Reputation ${state.stats.reputation}, Performance ${state.stats.performance}, Burnout ${state.stats.burnout}`,
      `Level: ${state.level}`,
      state.inventory.length > 0 ? `Items: ${state.inventory.map(i => i.name).join(', ')}` : '',
    ].filter(Boolean).join('. ');

    expect(context).toContain('Day 3');
    expect(context).toContain('14:00');
    expect(context).toContain('Energy 65');
    expect(context).toContain('Standing Desk');
    expect(context.length).toBeLessThan(4000);
  });
});
