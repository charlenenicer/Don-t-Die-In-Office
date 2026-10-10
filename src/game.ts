import * as THREE from 'three';
import { GameEngine } from './game-engine';
import { CHARACTERS } from './characters';
import { ITEMS } from './items';
import type { Character, InventoryItem } from './types';
import { GAME_HOURS_PER_REAL_SECOND } from './types';
import { VoiceClient } from './voice-client';
import {
  FOG_COLOR, PLAYER_COLORS, animateBird, buildWorld, colorsForCharacter,
  createBird, createSkyTexture, createWibbler, roomAt,
} from './visuals';
import type { BirdRig, Collider, Room, Seat } from './visuals';

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private engine: GameEngine;
  private voiceClient: VoiceClient;
  
  private player: THREE.Group;
  private playerRig: BirdRig;
  private sun: THREE.DirectionalLight;
  private walkAmount = 0;
  private colliders: Collider[] = [];
  private clockAccumulator = 0;
  private seats: Seat[] = [];
  private rooms: Room[] = [];
  private walls: THREE.Object3D[] = [];
  private occlusionRay = new THREE.Raycaster();
  private playerRoom: Room | null = null;
  private seatMarkers: THREE.Sprite[] = [];
  private currentSeat: Seat | null = null;
  private lastSitY = 0;
  private sitAmount = 0;
  // office-chair spin: angle relative to the seat's facing, and its speed (rad/s)
  private spinAngle = 0;
  private spinSpeed = 0;
  private hoveredMarker: THREE.Sprite | null = null;
  private raycaster = new THREE.Raycaster();
  // the player starts at the front of the office, facing the reception desk
  private playerPosition = new THREE.Vector3(0, 0, 16.4);
  private playerVelocity = new THREE.Vector3();
  
  private characters: Map<string, THREE.Group> = new Map();
  private characterLabels: Map<string, HTMLElement> = new Map();
  private itemMeshes: Map<string, THREE.Mesh> = new Map();
  
  private keys: Set<string> = new Set();
  private nearbyCharacter: Character | null = null;
  private nearbyItem: InventoryItem | null = null;
  
  private uiContainer: HTMLElement;
  private clock = new THREE.Clock();

  constructor(container: HTMLElement, uiContainer: HTMLElement) {
    this.uiContainer = uiContainer;
    this.engine = new GameEngine();
    this.voiceClient = new VoiceClient(this.engine);

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = createSkyTexture();
    this.scene.fog = new THREE.Fog(FOG_COLOR, 140, 1000);

    // Camera setup - third person
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1600
    );
    this.camera.position.set(0, 5.5, 23.5);
    this.camera.lookAt(0, 1.3, 15.4);

    // Renderer setup
    // Draw into the page's existing canvas; a second canvas would land below the viewport
    const canvas = container.querySelector<HTMLCanvasElement>('#game-canvas') ?? undefined;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (!canvas) container.appendChild(this.renderer.domElement);

    // Lighting - bright sun with soft shadows, sky fill from above
    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x9a8a5c, 1.1));

    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -24;
    shadowCam.right = 24;
    shadowCam.top = 24;
    shadowCam.bottom = -24;
    shadowCam.near = 1;
    shadowCam.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    // Build the office and the landscape around it
    const world = buildWorld(this.scene);
    this.colliders = world.colliders;
    this.seats = world.seats;
    this.rooms = world.rooms;
    this.walls = world.walls;
    this.createSeatMarkers();

    // Create player
    this.playerRig = createBird(PLAYER_COLORS);
    this.player = this.playerRig.group;
    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = Math.PI; // facing the receptionist
    this.scene.add(this.player);

    // Create NPCs
    this.createNPCs();
    
    // Create items
    this.createItems();

    // Input
    this.setupInput();
    
    // Subscribe to game state
    this.engine.subscribe((state) => this.onStateUpdate(state));

    // Handle window resize
    window.addEventListener('resize', () => this.onResize(container));

    // Start game loop

    this.animate();
  }

  private createNPCs() {
    CHARACTERS.forEach(char => {
      const rig = createBird(colorsForCharacter(char.id));
      const mesh = rig.group;
      mesh.position.set(...char.position);
      const [cx, , cz] = char.position;
      this.colliders.push({ minX: cx - 0.45, maxX: cx + 0.45, minZ: cz - 0.45, maxZ: cz + 0.45 });
      
      // Idle animation offset so everyone isn't in sync
      mesh.userData.bobOffset = Math.random() * Math.PI * 2;
      mesh.userData.character = char;
      mesh.userData.rig = rig;
      mesh.userData.sitting = !!char.sitting;
      mesh.userData.room = roomAt(this.rooms, char.position[0], char.position[2]);
      
      this.scene.add(mesh);
      this.characters.set(char.id, mesh);

      // Create label
      const label = document.createElement('div');
      label.className = 'character-label';
      label.textContent = char.name;
      label.style.display = 'none';
      this.uiContainer.appendChild(label);
      this.characterLabels.set(char.id, label);
    });
  }

  private createItems() {
    ITEMS.forEach(item => {
      const mesh = createWibbler();
      mesh.position.set(...item.position);
      mesh.userData.item = item;
      mesh.userData.room = roomAt(this.rooms, item.position[0], item.position[2]);
      
      // Gentle rotation
      mesh.userData.rotationSpeed = 0.5 + Math.random() * 0.5;
      
      this.scene.add(mesh);
      this.itemMeshes.set(item.id, mesh);
    });
  }

  private setupInput() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', (e) => {
      this.hoveredMarker = this.pickMarker(e);
      dom.style.cursor = this.hoveredMarker ? 'pointer' : '';
    });
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const marker = this.pickMarker(e);
      if (marker) this.sitDown(marker.userData.seat as Seat);
    });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      
      if (e.key.toLowerCase() === 'e') {
        this.interact();
      }

      // Space on an office chair gives it a push; each tap spins it faster
      if (e.key === ' ' && this.canSpin()) {
        e.preventDefault();
        if (!e.repeat) this.spinSpeed = Math.min(this.spinSpeed + 9, 30);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  private interact() {
    // E during a call hangs up
    if (this.voiceClient.isActive()) {
      this.voiceClient.endCall();
      return;
    }

    if (this.nearbyCharacter) {
      this.voiceClient.startCall(this.nearbyCharacter);
    }
    
    if (this.nearbyItem && !this.nearbyItem.collected) {
      this.engine.collectItem(this.nearbyItem);
      const mesh = this.itemMeshes.get(this.nearbyItem.id);
      if (mesh) {
        this.scene.remove(mesh);
      }
    }
  }

  /** Advance the in-game clock once per real second (paused on game over or while a choice is open). */
  private updateClock(delta: number) {
    // cap the step so a hidden tab doesn't fast-forward the day
    this.clockAccumulator += Math.min(delta, 0.25);
    if (this.clockAccumulator < 1) return;
    this.clockAccumulator -= 1;
    const state = this.engine.getState();
    if (state.isGameOver || state.activeChoice) return;
    this.engine.tickClock(GAME_HOURS_PER_REAL_SECOND);
  }

  private updatePlayer(delta: number) {
    const speed = 5;
    const direction = new THREE.Vector3();

    if (this.keys.has('w') || this.keys.has('arrowup')) direction.z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) direction.z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) direction.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) direction.x += 1;

    if (this.currentSeat) {
      if (direction.length() > 0) {
        this.standUp();
      } else {
        // glide onto the seat and face its direction
        const k = Math.min(1, delta * 9);
        this.playerPosition.x += (this.currentSeat.x - this.playerPosition.x) * k;
        this.playerPosition.z += (this.currentSeat.z - this.playerPosition.z) * k;
        if (this.updateSpin(delta)) {
          this.player.rotation.y = this.currentSeat.yaw + this.spinAngle;
        } else {
          let turn = this.currentSeat.yaw + this.spinAngle - this.player.rotation.y;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          this.player.rotation.y += turn * k;
        }
      }
    }

    if (direction.length() > 0) {
      direction.normalize();
      // Move in small sub-steps so a long frame can never skip through a thin wall
      const stepLength = speed * Math.min(delta, 0.1);
      const steps = Math.max(1, Math.ceil(stepLength / 0.12));
      for (let i = 0; i < steps; i++) {
        this.playerPosition.addScaledVector(direction, stepLength / steps);

        // Keep player in bounds
        this.playerPosition.x = Math.max(-22, Math.min(22, this.playerPosition.x));
        this.playerPosition.z = Math.max(-22, Math.min(20.5, this.playerPosition.z));

        this.resolveCollisions();
      }

      this.player.position.copy(this.playerPosition);

      // Turn smoothly toward the movement direction
      const targetYaw = Math.atan2(direction.x, direction.z);
      let diff = targetYaw - this.player.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.player.rotation.y += diff * Math.min(1, delta * 12);
    }

    // Sit pose eases in and out; the body drops to seat height
    this.sitAmount += ((this.currentSeat ? 1 : 0) - this.sitAmount) * Math.min(1, delta * 8);
    this.player.position.set(this.playerPosition.x, this.lastSitY * this.sitAmount, this.playerPosition.z);

    // Walk cycle eases in and out
    const target = direction.length() > 0 ? 1 : 0;
    this.walkAmount += (target - this.walkAmount) * Math.min(1, delta * 10);
    animateBird(this.playerRig, this.clock.elapsedTime, this.walkAmount, this.sitAmount);

    // Update camera to follow player (smoothed, low third-person)
    // Keep the camera inside the walls so it never ends up behind one
    const camTarget = new THREE.Vector3(
      Math.max(-23.5, Math.min(23.5, this.playerPosition.x)),
      5.5,
      Math.min(23.5, this.playerPosition.z + 9.5)
    );
    this.camera.position.lerp(camTarget, Math.min(1, delta * 5));
    this.camera.lookAt(this.playerPosition.x, 1.3, this.playerPosition.z - 1);

    // Sun and its shadow box follow the player
    this.sun.position.set(this.playerPosition.x + 14, 26, this.playerPosition.z + 10);
    this.sun.target.position.set(this.playerPosition.x, 0, this.playerPosition.z);

    // Rooms hide their contents until you're there; then check what you can reach
    this.updateRooms();
    this.checkNearbyInteractables();
  }




  // ------------------------------------------------------------------ seats

  /** Small white circles hovering over every seat; click one to sit. */
  private createSeatMarkers() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 64, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    for (const seat of this.seats) {
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false });
      const marker = new THREE.Sprite(material);
      marker.position.set(seat.x, seat.top + 0.45, seat.z);
      marker.scale.setScalar(0.5);
      marker.renderOrder = 20;
      marker.visible = false;
      marker.userData.seat = seat;
      this.scene.add(marker);
      this.seatMarkers.push(marker);
    }
  }

  private updateSeatMarkers() {
    const t = this.clock.elapsedTime;
    const range = 6.5;
    for (const marker of this.seatMarkers) {
      const seat = marker.userData.seat as Seat;
      const dist = Math.hypot(seat.x - this.playerPosition.x, seat.z - this.playerPosition.z);
      marker.visible = !this.currentSeat && dist < range && (seat.room ?? null) === (this.playerRoom?.id ?? null);
      if (!marker.visible) continue;
      (marker.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(1, (range - dist) / 1.5));
      const base = marker === this.hoveredMarker ? 0.66 : 0.5;
      marker.scale.setScalar(base * (1 + Math.sin(t * 3 + seat.x) * 0.06));
    }
    if (this.currentSeat) this.hoveredMarker = null;
  }

  private pickMarker(e: PointerEvent): THREE.Sprite | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.seatMarkers.filter((m) => m.visible), false);
    return (hits[0]?.object as THREE.Sprite | undefined) ?? null;
  }

  private sitDown(seat: Seat) {
    this.currentSeat = seat;
    this.lastSitY = seat.top - 0.66;
    this.hoveredMarker = null;
    this.renderer.domElement.style.cursor = '';
    window.dispatchEvent(new Event('seat-change'));
  }

  private isFree(x: number, z: number): boolean {
    const r = 0.45;
    if (Math.abs(x) > 22 || z < -22 || z > 20.5) return false;
    return this.colliders.every((c) => {
      const dx = x - Math.max(c.minX, Math.min(x, c.maxX));
      const dz = z - Math.max(c.minZ, Math.min(z, c.maxZ));
      return dx * dx + dz * dz >= r * r;
    });
  }

  /** Stand up in the nearest free spot beside the seat (behind it first). */
  private standUp() {
    const seat = this.currentSeat;
    if (!seat) return;
    const fx = Math.sin(seat.yaw);
    const fz = Math.cos(seat.yaw);
    const dirs: [number, number][] = [[-fx, -fz], [-fz, fx], [fz, -fx], [fx, fz]];
    let spot: [number, number] = [seat.x - fx * 1.1, seat.z - fz * 1.1];
    search: for (const dist of [0.9, 1.2, 1.6]) {
      for (const [dx, dz] of dirs) {
        const x = seat.x + dx * dist;
        const z = seat.z + dz * dist;
        if (this.isFree(x, z)) {
          spot = [x, z];
          break search;
        }
      }
    }
    this.playerPosition.set(spot[0], 0, spot[1]);
    // leave the chair facing its desk again
    this.spinSpeed = 0;
    this.spinAngle = 0;
    if (seat.swivel) seat.swivel.rotation.y = 0;
    this.currentSeat = null;
    window.dispatchEvent(new Event('seat-change'));
  }

  isSitting(): boolean {
    return this.currentSeat !== null;
  }

  /** Sitting on a swivel office chair (not a stool, sofa or dining chair). */
  canSpin(): boolean {
    return !!this.currentSeat?.swivel;
  }

  /**
   * Turn the chair by its spin speed, slowing with friction; once it has nearly
   * stopped it eases back round to face the desk. Returns true while spinning freely.
   */
  private updateSpin(delta: number): boolean {
    const swivel = this.currentSeat?.swivel;
    if (!swivel) return false;
    const spinning = this.spinSpeed > 1.5;
    if (spinning) {
      this.spinAngle += this.spinSpeed * delta;
      this.spinSpeed *= Math.exp(-0.9 * delta);
    } else {
      this.spinSpeed = 0;
      const rest = Math.atan2(Math.sin(this.spinAngle), Math.cos(this.spinAngle));
      this.spinAngle = rest * (1 - Math.min(1, delta * 4));
    }
    swivel.rotation.y = this.spinAngle;
    return spinning;
  }

  hasSeatNearby(): boolean {
    return this.seatMarkers.some((m) => m.visible);
  }

  /** Push the player out of walls and furniture (circle vs. box). */
  private resolveCollisions() {
    const radius = 0.45;
    const p = this.playerPosition;
    for (let pass = 0; pass < 3; pass++) for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - nx;
      const dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * radius;
        p.z = nz + (dz / d) * radius;
      } else {
        // centre is inside the box: leave by the nearest face
        const left = p.x - c.minX, right = c.maxX - p.x, up = p.z - c.minZ, down = c.maxZ - p.z;
        const m = Math.min(left, right, up, down);
        if (m === left) p.x = c.minX - radius;
        else if (m === right) p.x = c.maxX + radius;
        else if (m === up) p.z = c.minZ - radius;
        else p.z = c.maxZ + radius;
      }
    }
  }

  /** Things behind a wall can't be talked to or picked up from outside the room. */
  private inPlayersRoom(mesh: THREE.Object3D): boolean {
    const room = mesh.userData.room as Room | null;
    return (room?.id ?? null) === (this.playerRoom?.id ?? null);
  }

  /**
   * Rooms are closed boxes: their contents are only drawn when the player is at the
   * door or inside, and the wall facing the camera is cut away while inside.
   */
  private updateRooms() {
    const p = this.playerPosition;
    this.playerRoom = roomAt(this.rooms, p.x, p.z);
    const near = roomAt(this.rooms, p.x, p.z, 0.6);
    for (const room of this.rooms) {
      room.interior.visible = room === near;
    }

    // Walls: the one facing the camera goes while you're inside the room, and so does
    // any wall that happens to sit between the camera and the player.
    for (const wall of this.walls) wall.visible = true;
    for (const room of this.rooms) {
      for (const o of room.front) o.visible = room !== this.playerRoom;
    }
    const target = new THREE.Vector3(p.x, 1.2, p.z);
    for (const lateral of [-0.7, 0, 0.7]) {
      const aim = target.clone();
      aim.x += lateral;
      const dir = aim.sub(this.camera.position);
      const dist = dir.length();
      this.occlusionRay.set(this.camera.position, dir.normalize());
      this.occlusionRay.far = Math.max(0, dist - 0.3);
      for (const hit of this.occlusionRay.intersectObjects(this.walls, false)) hit.object.visible = false;
    }
    this.characters.forEach((mesh) => {
      const room = mesh.userData.room as Room | null;
      mesh.visible = !room || room === near;
    });
    this.itemMeshes.forEach((mesh) => {
      const room = mesh.userData.room as Room | null;
      mesh.visible = !room || room === near;
    });
  }

  private checkNearbyInteractables() {
    const interactionDistance = 2;
    let closestChar: Character | null = null;
    let closestDist = interactionDistance;

    this.characters.forEach((mesh, id) => {
      if (!this.inPlayersRoom(mesh)) return;
      const dist = this.playerPosition.distanceTo(mesh.position);
      if (dist < closestDist) {
        closestChar = mesh.userData.character;
        closestDist = dist;
      }
    });

    this.nearbyCharacter = closestChar;

    // Check items
    let closestItem: InventoryItem | null = null;
    let closestItemDist = interactionDistance;

    this.itemMeshes.forEach((mesh, id) => {
      const item = mesh.userData.item;
      if (!item.collected && this.inPlayersRoom(mesh)) {
        const dist = this.playerPosition.distanceTo(mesh.position);
        if (dist < closestItemDist) {
          closestItem = item;
          closestItemDist = dist;
        }
      }
    });

    this.nearbyItem = closestItem;
  }

  private updateNPCs(delta: number) {
    this.characters.forEach((mesh, id) => {
      const time = this.clock.elapsedTime + mesh.userData.bobOffset;
      animateBird(mesh.userData.rig as BirdRig, time, 0, mesh.userData.sitting ? 1 : 0);

      // Turn to face the player when they're close
      const dx = this.playerPosition.x - mesh.position.x;
      const dz = this.playerPosition.z - mesh.position.z;
      if (Math.hypot(dx, dz) < 7) {
        let diff = Math.atan2(dx, dz) - mesh.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        mesh.rotation.y += diff * Math.min(1, delta * 4);
      }
    });
  }

  private updateItems(delta: number) {
    this.itemMeshes.forEach(mesh => {
      if (!mesh.userData.item.collected) {
        mesh.rotation.y += delta * mesh.userData.rotationSpeed;
        mesh.position.y = 0.65 + Math.sin(Date.now() * 0.002) * 0.1;
      }
    });
  }

  private updateLabels() {
    this.characterLabels.forEach((label, id) => {
      const mesh = this.characters.get(id);
      if (!mesh) return;

      const char = mesh.userData.character;
      const isNearby = this.nearbyCharacter?.id === id;
      
      if (isNearby) {
        const vector = mesh.position.clone();
        vector.y += 2.8;
        vector.project(this.camera);

        const x = (vector.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth;
        const y = (vector.y * -0.5 + 0.5) * this.renderer.domElement.clientHeight;

        label.style.display = 'block';
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
      } else {
        label.style.display = 'none';
      }
    });
  }

  private onStateUpdate(state: any) {
    // Update UI will be handled by the main app
  }

  private onResize(container: HTMLElement) {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    const delta = this.clock.getDelta();
    
    this.updateClock(delta);
    this.updatePlayer(delta);
    this.updateSeatMarkers();
    this.updateNPCs(delta);
    this.updateItems(delta);
    this.updateLabels();
    
    this.renderer.render(this.scene, this.camera);
  };

  getEngine(): GameEngine {
    return this.engine;
  }

  getVoiceClient(): VoiceClient {
    return this.voiceClient;
  }

  getNearbyCharacter(): Character | null {
    return this.nearbyCharacter;
  }

  getNearbyItem(): InventoryItem | null {
    return this.nearbyItem;
  }
}
