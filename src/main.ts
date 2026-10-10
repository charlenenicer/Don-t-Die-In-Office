import { Game } from './game';
import './style.css';

class App {
  private game: Game | null = null;
  private statsElement: HTMLElement | null = null;
  private inventoryElement: HTMLElement | null = null;
  private timeElement: HTMLElement | null = null;
  private choiceModal: HTMLElement | null = null;
  private transcriptPanel: HTMLElement | null = null;
  private hintElement: HTMLElement | null = null;
  private gameOverModal: HTMLElement | null = null;
  private modeIndicator: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Check voice mode
    const response = await fetch('/api/voice/status');
    const { available } = await response.json();

    // Create UI
    const app = document.getElementById('app')!;
    app.innerHTML = `
      <div class="game-container">
        <canvas id="game-canvas"></canvas>
        <div class="ui-overlay"></div>
        
        <div class="hud">
          <div class="stats-panel">
            <div class="mode-indicator ${available ? 'voice' : 'demo'}">
              ${available ? 'Voice Mode' : 'Demo Mode'}
            </div>
            <div class="stat">
              <span class="stat-label">Energy</span>
              <div class="stat-bar">
                <div class="stat-fill energy" style="width: 80%"></div>
              </div>
              <span class="stat-value">80</span>
            </div>
            <div class="stat">
              <span class="stat-label">Reputation</span>
              <div class="stat-bar">
                <div class="stat-fill reputation" style="width: 50%"></div>
              </div>
              <span class="stat-value">50</span>
            </div>
            <div class="stat">
              <span class="stat-label">Performance</span>
              <div class="stat-bar">
                <div class="stat-fill performance" style="width: 50%"></div>
              </div>
              <span class="stat-value">50</span>
            </div>
            <div class="stat">
              <span class="stat-label">Burnout</span>
              <div class="stat-bar">
                <div class="stat-fill burnout" style="width: 0%"></div>
              </div>
              <span class="stat-value">0</span>
            </div>
          </div>

          <div class="time-panel">
            <div class="day">Day 1</div>
            <div class="time">9:00</div>
            <div class="level">Junior</div>
          </div>

          <div class="inventory-panel">
            <div class="inventory-title">Inventory</div>
            <div class="inventory-items"></div>
          </div>
        </div>

        <div class="hint">
          WASD/Arrows to move • E to interact
        </div>

        <div class="transcript-panel">
          <div class="transcript-header">
            <span>Conversation</span>
            <button class="close-transcript">×</button>
          </div>
          <div class="transcript-content"></div>
        </div>

        <div class="choice-modal hidden">
          <div class="choice-content">
            <h2 class="choice-title"></h2>
            <p class="choice-description"></p>
            <div class="choice-buttons">
              <button class="accept-button">Accept</button>
              <button class="decline-button">Decline</button>
            </div>
          </div>
        </div>

        <div class="game-over-modal hidden">
          <div class="game-over-content">
            <h2>Game Over</h2>
            <p class="game-over-reason"></p>
            <button class="restart-button">Restart</button>
          </div>
        </div>
      </div>
    `;

    this.statsElement = document.querySelector('.stats-panel')!;
    this.inventoryElement = document.querySelector('.inventory-items')!;
    this.timeElement = document.querySelector('.time-panel')!;
    this.choiceModal = document.querySelector('.choice-modal')!;
    this.transcriptPanel = document.querySelector('.transcript-panel')!;
    this.hintElement = document.querySelector('.hint')!;
    this.gameOverModal = document.querySelector('.game-over-modal')!;
    this.modeIndicator = document.querySelector('.mode-indicator')!;

    // Initialize game
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const uiOverlay = document.querySelector('.ui-overlay') as HTMLElement;
    this.game = new Game(canvas.parentElement!, uiOverlay);

    // Subscribe to game state
    this.game.getEngine().subscribe((state) => this.updateUI(state));

    // Setup event listeners
    this.setupEventListeners();

    // Keep the hint current as the player moves around and sits
    window.addEventListener('seat-change', () => this.refreshHint());
    setInterval(() => this.refreshHint(), 150);

    // Listen for transcript updates
    window.addEventListener('transcript', (event: any) => {
      this.addTranscriptLine(event.detail.role, event.detail.text);
    });
  }

  private setupEventListeners() {
    document.querySelector('.accept-button')?.addEventListener('click', () => {
      this.game?.getEngine().acceptChoice();
    });

    document.querySelector('.decline-button')?.addEventListener('click', () => {
      this.game?.getEngine().declineChoice();
    });

    document.querySelector('.restart-button')?.addEventListener('click', () => {
      this.game?.getEngine().reset();
      this.gameOverModal?.classList.add('hidden');
    });

    document.querySelector('.close-transcript')?.addEventListener('click', () => {
      this.transcriptPanel?.classList.remove('visible');
    });
  }

  private updateUI(state: any) {
    // Update stats
    const stats = ['energy', 'reputation', 'performance', 'burnout'];
    stats.forEach(stat => {
      const value = state.stats[stat];
      const fill = this.statsElement?.querySelector(`.stat-fill.${stat}`) as HTMLElement;
      const valueEl = fill?.parentElement?.nextElementSibling as HTMLElement;
      
      if (fill) fill.style.width = `${value}%`;
      if (valueEl) valueEl.textContent = Math.round(value).toString();
    });

    // Update time
    if (this.timeElement) {
      this.timeElement.querySelector('.day')!.textContent = `Day ${state.dayNumber}`;
      const hour = Math.floor(state.dayTime);
      this.timeElement.querySelector('.time')!.textContent = `${hour}:00`;
      this.timeElement.querySelector('.level')!.textContent = state.level.charAt(0).toUpperCase() + state.level.slice(1);
    }

    // Update inventory
    if (this.inventoryElement) {
      this.inventoryElement.innerHTML = state.inventory
        .map((item: any) => `<div class="inventory-item" title="${item.description}">${item.name}</div>`)
        .join('');
    }

    this.refreshHint();

    // Show/hide choice modal
    if (state.activeChoice) {
      this.showChoice(state.activeChoice);
    } else {
      this.choiceModal?.classList.add('hidden');
    }

    // Show game over
    if (state.isGameOver) {
      this.showGameOver(state.gameOverReason);
    }

    // Show transcript when in call
    if (this.game?.getVoiceClient().isActive()) {
      this.transcriptPanel?.classList.add('visible');
    }
  }

  private refreshHint() {
    if (!this.hintElement || !this.game) return;
    const nearbyChar = this.game.getNearbyCharacter();
    const nearbyItem = this.game.getNearbyItem();

    let text = 'WASD/Arrows to move • E to interact';
    if (this.game.isSitting()) {
      text = 'Seated • press WASD / arrows to stand up';
    } else if (nearbyChar) {
      text = `Press E to talk to ${nearbyChar.name}`;
    } else if (nearbyItem && !nearbyItem.collected) {
      text = `Press E to collect ${nearbyItem.name}`;
    } else if (this.game.hasSeatNearby()) {
      text = 'Click a white circle to sit • WASD to move';
    }
    if (this.hintElement.textContent !== text) this.hintElement.textContent = text;
  }

  private showChoice(choice: any) {
    this.choiceModal?.classList.remove('hidden');
    this.choiceModal!.querySelector('.choice-title')!.textContent = choice.title;
    this.choiceModal!.querySelector('.choice-description')!.textContent = choice.description;
  }

  private showGameOver(reason: string) {
    this.gameOverModal?.classList.remove('hidden');
    this.gameOverModal!.querySelector('.game-over-reason')!.textContent = reason;
  }

  private addTranscriptLine(role: string, text: string) {
    const content = this.transcriptPanel?.querySelector('.transcript-content');
    if (!content) return;

    const line = document.createElement('div');
    line.className = `transcript-line ${role}`;
    line.textContent = `${role === 'agent' ? 'Them' : 'You'}: ${text}`;
    content.appendChild(line);
    content.scrollTop = content.scrollHeight;
  }
}

new App();
