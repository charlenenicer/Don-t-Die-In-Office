import type { InventoryItem } from './types';

export const ITEMS: InventoryItem[] = [
  {
    id: 'standing-desk',
    name: 'Standing Desk',
    description: 'Better ergonomics, more energy throughout the day',
    position: [6, 0, 0.5],
    effects: { energy: 10 },
    collected: false,
  },
  {
    id: 'ergonomic-chair',
    name: 'Ergonomic Office Chair',
    description: 'Reduces fatigue, helps you work sustainably',
    position: [-6, 0, 11],
    effects: { burnout: -5 },
    collected: false,
  },
  {
    id: 'noise-cancelling-headphones',
    name: 'Noise-Cancelling Headphones',
    description: 'Deep focus, better quality work',
    position: [-9.5, 0, 6],
    effects: { performance: 5 },
    collected: false,
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant Subscription',
    description: 'Automates busywork, frees up time',
    position: [16, 0, -4.5],
    effects: { performance: 5, energy: 5 },
    collected: false,
  },
  {
    id: 'coffee-machine',
    name: 'Premium Coffee Machine',
    description: 'Better coffee, small morale boost',
    position: [-12.8, 0, -7.3],
    effects: { energy: 5, reputation: 3 },
    collected: false,
  },
  {
    id: 'calendar-blocker',
    name: 'Focus Time Calendar Blocker',
    description: 'Protected time, fewer interruptions',
    position: [-21, 0, -16],
    effects: { performance: 5, burnout: -5 },
    collected: false,
  },
];
