import type { Character } from './types';
import { formatClock, hoursUntilReview, DAY_NAMES, REVIEW_HOUR } from './types';
import { GameEngine } from './game-engine';
import { getClosingLine, getFirstMessage } from './characters';
import type { EndReason } from './characters';
import { GOODBYE_SILENCE_MS, drainDelayMs, isWindingDown, speechMs } from './call-ending';
import { playerSnapshot } from './player-snapshot';

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
  /** set once the conversation is ending; a second hang-up is immediate */
  private ending = false;
  private timers: number[] = [];
  /** the player said goodbye; hang up after the coworker's reply if they don't */
  private playerWindingDown = false;
  private silenceTimer: number | null = null;
  private pollTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastReport = 0;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  async startCall(character: Character): Promise<void> {
    if (this.active) return;

    this.currentCharacter = character;
    this.active = true;
    this.ending = false;
    this.playerWindingDown = false;
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
      // the engine closing the socket (e.g. after the agent hangs up): let the last line finish
      this.ws.onclose = () => this.finishAfterAudio();
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.endCall();
      };

    } catch (error) {
      console.error('Failed to start call:', error);
      // fall back to the demo conversation (still an active call, so it can close itself)
      this.stopMicrophone();
      this.ws = null;
      this.startDemoMode(character);
    }
  }

  /**
   * Demo mode (no voice key or agent): the same conversation shape as a live call,
   * as captions. A rotating opener, the coworker's ask, then an in-character closing
   * line, and the call ends once that line has had time to be "said".
   */
  private startDemoMode(character: Character) {
    const firstMessage = getFirstMessage(character);
    this.addTranscript('agent', firstMessage);
    this.later(() => {
      // the opener may already have triggered the offer through keyword detection
      if (!this.offerPresented) {
        this.offerPresented = true;
        this.createDemoOffer(character);
      }
      this.later(() => this.closeWith(getClosingLine(character, 'wrap-up')), 1200);
    }, speechMs(firstMessage));
  }

  /** The coworker says one closing line, then the call ends when it has been heard. */
  private closeWith(line: string) {
    if (!this.active || this.ending) return;
    this.ending = true;
    this.addTranscript('agent', line);
    this.later(() => this.endCall(), speechMs(line));
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private createDemoOffer(character: Character, fromTool?: { title: string; description: string }) {
    const offers: Record<string, any> = {
      flatterer: {
        title: 'Weekend Sprint',
        description: 'Marcus needs help with an "urgent" presentation. Says it will only take a few hours this Saturday.',
        accept: {
          immediate: { performance: 10, energy: -15 },
          delayed: { burnout: 10 },
          delayHours: 2,
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
          delayHours: 3,
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
          delayHours: 4,
        },
        decline: {
          immediate: { },
        },
      },
    };

    const base = offers[character.archetype];
    // an offer made with the make_offer tool keeps the archetype's stakes but uses the agent's words
    const offer = base && fromTool ? { ...base, title: fromTool.title, description: fromTool.description } : base;
    if (offer && this.engine.hasOfferedToday(character.id)) {
      window.dispatchEvent(new CustomEvent('toast', {
        detail: `${character.name} already asked you for something today\nOne offer per person per day`,
      }));
    } else if (offer) {
      this.engine.presentChoice({
        id: `demo-${character.id}-${Date.now()}`,
        characterId: character.id,
        ...offer,
      });
    }
  }

  private onWebSocketOpen() {
    if (!this.ws || !this.currentCharacter) return;

    const state = this.engine.getState();
    const memory = this.engine.getMemorySummary(this.currentCharacter.id);

    // Build context
    const reviewIn = Math.round(hoursUntilReview(state.dayNumber, state.dayTime));
    const context = [
      `${DAY_NAMES[state.dayNumber - 1] ?? `Day ${state.dayNumber}`}, ${formatClock(state.dayTime)}`,
      `The player's performance review with the boss is ${DAY_NAMES[DAY_NAMES.length - 1]} at ${REVIEW_HOUR}:00, ${reviewIn} work hours from now`,
      `Stats: Energy ${state.stats.energy}, Reputation ${state.stats.reputation}, Performance ${state.stats.performance}, Burnout ${state.stats.burnout}`,
      `Level: ${state.level}`,
      state.inventory.length > 0 ? `Items: ${state.inventory.map(i => i.name).join(', ')}` : '',
      memory ? `Previous conversations: ${memory}` : '',
      this.engine.wasPromoted() ? 'Recently promoted' : '',
      // the same words check_player returns, so the agent has them even before calling it
      `How they seem: ${playerSnapshot(state, this.engine.wasPromoted()).summary.replace(/\.$/, "")}`,
    ].filter(Boolean).join('. ');

    // Start call
    this.ws.send(JSON.stringify({
      type: 'start_call',
      agent: { id: this.currentCharacter.agentId },
      context,
    }));

    // check_player reads what the game reports; make_offer comes back through the events poll
    this.reportPlayer(true);
    this.unsubscribe = this.engine.subscribe(() => this.reportPlayer());
    this.pollTimer = window.setInterval(() => this.pollEvents(), 1500);

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
          this.reportPlayer(true);
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
          // the agent hung up after its closing line: let that line finish playing first
          this.finishAfterAudio();
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
    if (this.silenceTimer !== null) this.armGoodbyeTimer();
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

    // the player is wrapping up: the agent is prompted to close; if it replies and
    // then goes quiet without hanging up, the game hangs up for it
    if (this.ws && role === 'caller' && isWindingDown(text)) this.playerWindingDown = true;
    else if (this.ws && role === 'agent' && this.playerWindingDown) this.armGoodbyeTimer();
    
    // Monitor agent messages for offer/request keywords (mid-call detection)
    if (role === 'agent' && !this.offerPresented && !this.ending && this.currentCharacter) {
      if (this.detectOfferIntent(text, this.currentCharacter)) {
        this.offerPresented = true;
        this.createDemoOffer(this.currentCharacter);
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

  /**
   * The player ends the conversation (E again, or walking away). Whatever the
   * coworker is saying finishes, they get a short farewell, then the call ends.
   * Called again while ending, it hangs up straight away.
   */
  hangUp(reason: EndReason = 'walk-away') {
    if (!this.active) return;
    if (this.ending) {
      this.endCall();
      return;
    }
    const character = this.currentCharacter!;
    this.ending = true;
    this.stopMicrophone();
    const farewell = getClosingLine(character, reason);
    if (!this.ws) {
      // demo: the farewell is the last caption, then the call ends once it's "said"
      for (const t of this.timers) clearTimeout(t);
      this.timers = [];
      this.addTranscript('agent', farewell);
      this.later(() => this.endCall(), speechMs(farewell));
      return;
    }
    // live: let the current line finish, show the farewell as a caption, then hang up
    const wait = this.audioContext ? drainDelayMs(this.playhead, this.audioContext.currentTime) : 0;
    this.later(() => {
      this.addTranscript('agent', farewell);
      this.later(() => this.endCall(), Math.min(1800, speechMs(farewell)));
    }, wait);
  }

  /** The other side ended the call: tear down once the queued audio has played. */
  private finishAfterAudio() {
    if (!this.active) return;
    this.ending = true;
    this.stopMicrophone();
    const wait = this.audioContext ? drainDelayMs(this.playhead, this.audioContext.currentTime) : 0;
    if (wait <= 0) this.endCall();
    else this.later(() => this.endCall(), wait);
  }

  /** Hang up for the agent if it answered a goodbye and then stayed quiet. */
  private armGoodbyeTimer() {
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    const wait = (this.audioContext ? drainDelayMs(this.playhead, this.audioContext.currentTime) : 0) + GOODBYE_SILENCE_MS;
    this.silenceTimer = window.setTimeout(() => {
      this.silenceTimer = null;
      if (this.active && this.playing.size === 0) this.finishAfterAudio();
      else if (this.active) this.armGoodbyeTimer();
    }, wait);
  }

  /** Tell the server how the player is doing, for check_player (throttled unless forced). */
  private reportPlayer(force = false) {
    const character = this.currentCharacter;
    if (!character || !this.ws) return;
    const now = Date.now();
    if (!force && now - this.lastReport < 1000) return;
    this.lastReport = now;
    const snapshot = playerSnapshot(this.engine.getState(), this.engine.wasPromoted());
    fetch('/api/call/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: this.callId, agentId: character.agentId, snapshot }),
    }).catch(() => {});
  }

  /** Offers the agent made with make_offer. */
  private async pollEvents() {
    const character = this.currentCharacter;
    if (!character || !this.ws) return;
    const qs = new URLSearchParams({ agentId: character.agentId ?? '', ...(this.callId ? { callId: this.callId } : {}) });
    try {
      const res = await fetch(`/api/call/events?${qs}`);
      if (!res.ok) return;
      const { offers } = await res.json();
      const offer = offers?.[0];
      if (offer && !this.offerPresented && this.currentCharacter === character) {
        this.offerPresented = true;
        this.createDemoOffer(character, offer);
      }
    } catch {}
  }

  private stopMicrophone() {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  /** Tear the call down now. Prefer hangUp() for anything the player does. */
  endCall() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (!this.active) return;

    // End-of-call fallback: only present offer if nothing fired mid-call
    const voiceCharacter = this.ws ? this.currentCharacter : null;
    const agentSpoke = this.transcript.some(line => line.role === 'agent');
    const shouldPresentFallback = voiceCharacter && agentSpoke && !this.offerPresented;

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'end_call' }));
      }
      ws.close();
    }

    this.stopMicrophone();

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
    this.ending = false;
    this.playerWindingDown = false;
    this.currentCharacter = null;
    this.callId = null;
    this.offerPresented = false;

    if (shouldPresentFallback) {
      this.createDemoOffer(voiceCharacter!);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  /** True once the conversation is wrapping up (closing line playing). */
  isEnding(): boolean {
    return this.ending;
  }

  getCurrentCharacter(): Character | null {
    return this.currentCharacter;
  }

  getTranscript() {
    return this.transcript;
  }
}
