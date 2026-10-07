import type { Character } from './types';
import { GameEngine } from './game-engine';
import { getFirstMessage } from './characters';

interface AudioFrame {
  type: 'audio';
  data: string;
  format: 'pcm16';
  sample_rate: number;
}

interface TranscriptFrame {
  type: 'transcript';
  role?: string;
  text?: string;
  content?: string;
}

// What the engine actually sends for each spoken line:
// {"type":"conversation_message","role":"assistant"|"user","content":"..."}
interface ConversationMessageFrame {
  type: 'conversation_message';
  role: string;
  content: string;
}

interface MarkFrame {
  type: 'mark';
  name: string;
}

interface CallStartedFrame {
  type: 'call_started';
  call_id: string;
}

interface CallEndedFrame {
  type: 'call_ended';
  reason: string;
  ended_by?: string;
}

interface ClearAudioFrame {
  type: 'clear_audio';
}

type Frame = AudioFrame | TranscriptFrame | ConversationMessageFrame | MarkFrame | CallStartedFrame | CallEndedFrame | ClearAudioFrame;

const MIC_RATE = 16000;        // engine expects PCM16, 16 kHz, mono
const MIC_FRAME_SAMPLES = 320; // 20 ms frames (640 bytes)

export class VoiceClient {
  private engine: GameEngine;
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private micContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private micBuffer: number[] = [];
  private micPos = 0;
  private currentCharacter: Character | null = null;
  private callId: string | null = null;
  
  private playhead = 0;
  private playing = new Set<AudioBufferSourceNode>();
  private heldMarks: MarkFrame[] = [];
  
  private active = false;
  private transcript: Array<{ role: string; text: string }> = [];
  private offerPresented = false;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  async startCall(character: Character): Promise<void> {
    if (this.active) return;

    this.currentCharacter = character;
    this.active = true;
    this.transcript = [];
    this.offerPresented = false;

    // Check if voice mode is available
    const response = await fetch('/api/voice/status');
    const { available, agents } = await response.json();
    // Agent ids come from the server (agents-config.json written by `npm run setup-agents`)
    if (agents && agents[character.id]) {
      character.agentId = agents[character.id];
    }

    if (!available || !character.agentId) {
      // Demo mode - use text dialogue
      this.startDemoMode(character);
      return;
    }

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      // Mic capture runs at the device's native rate and is resampled to 16 kHz;
      // some browsers refuse a mic source on a context with a different rate.
      this.micContext = new AudioContext();
      // startCall runs after awaits, so the contexts may start suspended
      await Promise.all([this.audioContext.resume(), this.micContext.resume()]).catch(() => {});

      // Connect to WebSocket via server proxy (wss on HTTPS pages, or the browser blocks it)
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(`${scheme}://${window.location.host}/ws/call`);

      this.ws.onopen = () => this.onWebSocketOpen();
      this.ws.onmessage = (event) => this.onWebSocketMessage(event);
      this.ws.onclose = () => this.endCall();
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.endCall();
      };

    } catch (error) {
      console.error('Failed to start call:', error);
      this.active = false;
      this.startDemoMode(character);
    }
  }

  private startDemoMode(character: Character) {
    // Show demo dialogue
    const firstMessage = getFirstMessage(character);
    this.addTranscript('agent', firstMessage);
    
    // Simulate offers based on character archetype
    setTimeout(() => {
      this.createDemoOffer(character);
    }, 2000);
  }

  private createDemoOffer(character: Character, endAfter = true) {
    const offers: Record<string, any> = {
      flatterer: {
        title: 'Weekend Sprint',
        description: 'Marcus needs help with an "urgent" presentation. Says it will only take a few hours this Saturday.',
        accept: {
          immediate: { performance: 10, energy: -15 },
          delayed: { burnout: 10 },
          delayTurns: 2,
        },
        decline: {
          immediate: { reputation: -5 },
        },
      },
      jealous: {
        title: character.wasPromoted ? 'Passive-Aggressive Comment' : 'Team Lunch',
        description: character.wasPromoted 
          ? 'Sarah questions if you\'re "really ready" for your new role. Respond?'
          : 'Sarah invites you to team lunch. Seems friendly.',
        accept: {
          immediate: character.wasPromoted ? { energy: -5 } : { reputation: 5 },
        },
        decline: {
          immediate: { reputation: -3 },
        },
      },
      overconfident: {
        title: 'Brad\'s Advice: Skip Testing',
        description: 'Brad suggests shipping without tests to "move faster and impress people."',
        accept: {
          immediate: { performance: 5 },
          delayed: { performance: -15, reputation: -10 },
          delayTurns: 3,
        },
        decline: {
          immediate: { },
        },
      },
      burnout: {
        title: 'Emergency Late Night',
        description: 'Diana needs you to stay late for a "one-time emergency." It\'s the third this week.',
        accept: {
          immediate: { performance: 8, energy: -20, burnout: 15 },
        },
        decline: {
          immediate: { reputation: -8 },
        },
      },
      mentor: {
        title: 'James\'s Advice: Set Boundaries',
        description: 'James suggests learning to say no respectfully. Would protect your energy.',
        accept: {
          immediate: { energy: 5, burnout: -5 },
        },
        decline: {
          immediate: { },
        },
      },
      gossip: {
        title: 'Office Gossip',
        description: 'Taylor shares sensitive information and asks you to keep it quiet.',
        accept: {
          immediate: { reputation: 3 },
          delayed: { reputation: -5 },
          delayTurns: 4,
        },
        decline: {
          immediate: { },
        },
      },
    };

    const offer = offers[character.archetype];
    if (offer) {
      this.engine.presentChoice({
        id: `demo-${character.id}-${Date.now()}`,
        characterId: character.id,
        ...offer,
      });
    }

    if (!endAfter) return;

    // End demo call after offer
    setTimeout(() => {
      this.addTranscript('agent', 'Alright, talk to you later.');
      setTimeout(() => this.endCall(), 1000);
    }, 1000);
  }

  private onWebSocketOpen() {
    if (!this.ws || !this.currentCharacter) return;

    const state = this.engine.getState();
    const memory = this.engine.getMemorySummary(this.currentCharacter.id);

    // Build context
    const context = [
      `Day ${state.dayNumber}, ${Math.floor(state.dayTime)}:00`,
      `Stats: Energy ${state.stats.energy}, Reputation ${state.stats.reputation}, Performance ${state.stats.performance}, Burnout ${state.stats.burnout}`,
      `Level: ${state.level}`,
      state.inventory.length > 0 ? `Items: ${state.inventory.map(i => i.name).join(', ')}` : '',
      memory ? `Previous conversations: ${memory}` : '',
      this.engine.wasPromoted() ? 'Recently promoted' : '',
    ].filter(Boolean).join('. ');

    // Start call
    this.ws.send(JSON.stringify({
      type: 'start_call',
      agent: { id: this.currentCharacter.agentId },
      context,
    }));

    // Start microphone streaming
    this.startMicrophoneStreaming();
  }

  private startMicrophoneStreaming() {
    if (!this.micContext || !this.mediaStream) return;

    const ctx = this.micContext;
    const source = ctx.createMediaStreamSource(this.mediaStream);
    // ScriptProcessor buffer sizes must be a power of two (256..16384)
    this.processor = ctx.createScriptProcessor(2048, 1, 1);
    const step = ctx.sampleRate / MIC_RATE;
    this.micBuffer = [];
    this.micPos = 0;

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);

      // Linear-interpolation resample from the context rate to 16 kHz
      let pos = this.micPos;
      while (pos < input.length - 1) {
        const i = Math.floor(pos);
        const frac = pos - i;
        this.micBuffer.push(input[i] + (input[i + 1] - input[i]) * frac);
        pos += step;
      }
      this.micPos = pos - input.length;
      if (this.micPos < 0) this.micPos = 0;

      // Send 20 ms frames of PCM16 (320 samples, 640 bytes)
      while (this.micBuffer.length >= MIC_FRAME_SAMPLES) {
        const chunk = this.micBuffer.splice(0, MIC_FRAME_SAMPLES);
        const pcm16 = new Int16Array(MIC_FRAME_SAMPLES);
        for (let i = 0; i < MIC_FRAME_SAMPLES; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(pcm16.buffer);
        }
      }
    };

    source.connect(this.processor);
    // Must reach a destination for onaudioprocess to fire; the output buffer stays silent.
    this.processor.connect(ctx.destination);
  }

  private onWebSocketMessage(event: MessageEvent) {
    if (typeof event.data === 'string') {
      const frame: Frame = JSON.parse(event.data);
      
      switch (frame.type) {
        case 'call_started':
          this.callId = frame.call_id;
          break;

        case 'audio':
          this.playAudio(frame);
          break;

        case 'mark':
          this.handleMark(frame);
          break;

        case 'clear_audio':
          this.clearAudio();
          break;

        case 'transcript': {
          const text = frame.text ?? frame.content;
          if (text) this.addTranscript(frame.role === 'assistant' || frame.role === 'agent' ? 'agent' : 'caller', text);
          break;
        }

        case 'conversation_message':
          if (frame.content) {
            this.addTranscript(frame.role === 'assistant' ? 'agent' : 'caller', frame.content);
          }
          break;

        case 'call_ended':
          this.endCall();
          break;
      }
    }
  }

  private playAudio(frame: AudioFrame) {
    if (!this.audioContext) return;

    const bytes = Uint8Array.from(atob(frame.data), c => c.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    
    if (!pcm.length) return;

    const buffer = this.audioContext.createBuffer(1, pcm.length, frame.sample_rate || 24000);
    buffer.getChannelData(0).set(Float32Array.from(pcm, s => s / 32768));

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Schedule playback
    if (this.playhead <= this.audioContext.currentTime) {
      this.playhead = this.audioContext.currentTime + 0.18;
    }
    source.start(this.playhead);
    this.playhead += buffer.duration;

    this.playing.add(source);
    source.onended = () => {
      this.playing.delete(source);
      if (this.playing.size === 0) {
        this.sendHeldMarks();
      }
    };
  }

  private handleMark(frame: MarkFrame) {
    this.heldMarks.push(frame);
    if (this.playing.size === 0) {
      this.sendHeldMarks();
    }
  }

  private sendHeldMarks() {
    while (this.heldMarks.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(this.heldMarks.shift()));
    }
  }

  private clearAudio() {
    // Stop all scheduled audio
    for (const source of this.playing) {
      try {
        source.stop();
      } catch {}
    }
    this.playing.clear();
    this.playhead = 0;
    this.sendHeldMarks();
  }

  private addTranscript(role: string, text: string) {
    this.transcript.push({ role, text });
    
    // Monitor agent messages for offer/request keywords (mid-call detection)
    if (role === 'agent' && !this.offerPresented && this.currentCharacter) {
      if (this.detectOfferIntent(text, this.currentCharacter)) {
        this.offerPresented = true;
        this.createDemoOffer(this.currentCharacter, false);
      }
    }
    
    // Emit transcript event for UI
    window.dispatchEvent(new CustomEvent('transcript', {
      detail: { role, text, characterId: this.currentCharacter?.id }
    }));
  }

  private detectOfferIntent(text: string, character: Character): boolean {
    const lower = text.toLowerCase();
    
    // Character-specific offer patterns
    const patterns: Record<string, string[]> = {
      flatterer: ['could you', 'can you take', 'need you to', 'would you mind', 'help me with', 'urgent', 'really need'],
      jealous: ['must be nice', 'some of us', 'not everyone', 'when you have time'],
      overconfident: ['trust me', 'what worked for me', 'you should', 'skip', 'just'],
      burnout: ['stay late', 'work late', 'come in', 'weekend', 'tonight', 'emergency', 'urgent', 'all hands'],
      mentor: ['try', 'suggest', 'might help', 'consider', 'boundary', 'pace yourself'],
      gossip: ['did you hear', 'between us', 'don\'t tell', 'heard that', 'apparently'],
    };
    
    const keywords = patterns[character.archetype] || [];
    return keywords.some(keyword => lower.includes(keyword));
  }

  endCall() {
    // End-of-call fallback: only present offer if nothing fired mid-call
    const voiceCharacter = this.ws ? this.currentCharacter : null;
    const agentSpoke = this.transcript.some(line => line.role === 'agent');
    const shouldPresentFallback = voiceCharacter && agentSpoke && !this.offerPresented;

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'end_call' }));
      }
      this.ws.close();
      this.ws = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.micContext) {
      this.micContext.close();
      this.micContext = null;
    }
    this.micBuffer = [];

    this.playing.clear();
    this.heldMarks = [];
    this.playhead = 0;
    this.active = false;
    this.currentCharacter = null;
    this.callId = null;
    this.offerPresented = false;

    if (shouldPresentFallback) {
      this.createDemoOffer(voiceCharacter!, false);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getCurrentCharacter(): Character | null {
    return this.currentCharacter;
  }

  getTranscript() {
    return this.transcript;
  }
}
