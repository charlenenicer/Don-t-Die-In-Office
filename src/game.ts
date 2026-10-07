import * as THREE from 'three';
import { GameEngine } from './game-engine';
import { CHARACTERS } from './characters';
import { ITEMS } from './items';
import type { Character, InventoryItem } from './types';
import { VoiceClient } from './voice-client';

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private engine: GameEngine;
  private voiceClient: VoiceClient;
  
  private player: THREE.Group;
  private playerPosition = new THREE.Vector3(0, 0, 0);
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
    this.scene.background = new THREE.Color(0xe8f4f8);
    this.scene.fog = new THREE.Fog(0xe8f4f8, 30, 80);

    // Camera setup - third person
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    // Draw into the page's existing canvas; a second canvas would land below the viewport
    const canvas = container.querySelector<HTMLCanvasElement>('#game-canvas') ?? undefined;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (!canvas) container.appendChild(this.renderer.domElement);

    // Lighting - soft, flat lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xfff5e6, 0.4);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Build the office
    this.buildOffice();
    
    // Create player
    this.player = this.createCharacterMesh('#4A90E2', 0.5);
    this.player.position.copy(this.playerPosition);
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

  private buildOffice() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xf5f5dc,
      roughness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Cubicle walls - simple partitions
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xd3d3d3,
      roughness: 0.7,
    });

    // Create cubicle pods (4 clusters)
    const positions = [
      [3, 3], [3, -3], [-3, 3], [-3, -3]
    ];

    positions.forEach(pos => {
      const [x, z] = pos;
      // Low walls around desk
      const wall1 = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.2, 0.1),
        wallMaterial
      );
      wall1.position.set(x, 0.6, z + 1.5);
      this.scene.add(wall1);

      const wall2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.2, 3),
        wallMaterial
      );
      wall2.position.set(x + 1.5, 0.6, z);
      this.scene.add(wall2);
    });

    // Kitchen area
    const kitchenFloor = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.05, 4),
      new THREE.MeshStandardMaterial({ color: 0xdcdcdc })
    );
    kitchenFloor.position.set(-12, 0.025, 0);
    this.scene.add(kitchenFloor);

    // Kitchen counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x8b7355 })
    );
    counter.position.set(-12, 0.4, -1);
    this.scene.add(counter);

    // Meeting room - glass walls
    const glassMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.3,
      roughness: 0.1,
    });

    const meetingWalls = [
      new THREE.Vector3(-8, 1, -8),
      new THREE.Vector3(-5, 1, -8),
    ];

    meetingWalls.forEach(pos => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2, 0.1),
        glassMaterial
      );
      wall.position.copy(pos);
      this.scene.add(wall);
    });

    // Boss's corner office - glass walls
    const bossOfficeWalls = [
      { pos: [14, 1, 12] as [number, number, number], size: [0.1, 2, 6] as [number, number, number] },
      { pos: [11, 1, 15] as [number, number, number], size: [6, 2, 0.1] as [number, number, number] },
    ];

    bossOfficeWalls.forEach(({ pos, size }) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        glassMaterial
      );
      wall.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(wall);
    });

    // Plants - simple cylinders with spheres
    const plantPositions = [
      [7, 0], [-7, 0], [0, 10], [0, -10],
      [15, 5], [-15, 5],
    ];

    plantPositions.forEach(([x, z]) => {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
      );
      pot.position.set(x, 0.25, z);
      this.scene.add(pot);

      const plant = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x228b22 })
      );
      plant.position.set(x, 0.9, z);
      plant.scale.y = 1.5;
      this.scene.add(plant);
    });

    // Windows - just bright rectangles on the edges
    const windowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      opacity: 0.6,
      transparent: true,
    });

    const windowPositions = [
      { pos: [-25, 2, 0] as [number, number, number], size: [0.1, 3, 8] as [number, number, number] },
      { pos: [25, 2, 0] as [number, number, number], size: [0.1, 3, 8] as [number, number, number] },
      { pos: [0, 2, -25] as [number, number, number], size: [8, 3, 0.1] as [number, number, number] },
      { pos: [0, 2, 25] as [number, number, number], size: [8, 3, 0.1] as [number, number, number] },
    ];

    windowPositions.forEach(({ pos, size }) => {
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        windowMaterial
      );
      window.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(window);
    });
  }

  private createCharacterMesh(color: string, scale: number = 1): THREE.Group {
    // Simple rounded character - sphere body, smaller sphere head
    const group = new THREE.Group();
    
    const bodyGeometry = new THREE.SphereGeometry(0.5 * scale, 16, 16);
    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeometry, material);
    body.scale.y = 1.2;
    body.position.y = 0.5 * scale;
    group.add(body);

    const headGeometry = new THREE.SphereGeometry(0.3 * scale, 16, 16);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 1.1 * scale;
    group.add(head);

    // Simple face - two small spheres for eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05 * scale, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1 * scale, 1.15 * scale, 0.25 * scale);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1 * scale, 1.15 * scale, 0.25 * scale);
    group.add(rightEye);

    return group;
  }

  private createNPCs() {
    CHARACTERS.forEach(char => {
      const mesh = this.createCharacterMesh(char.color);
      mesh.position.set(...char.position);
      
      // Gentle bobbing animation
      mesh.userData.bobOffset = Math.random() * Math.PI * 2;
      mesh.userData.character = char;
      
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
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...item.position);
      mesh.userData.item = item;
      
      // Gentle rotation
      mesh.userData.rotationSpeed = 0.5 + Math.random() * 0.5;
      
      this.scene.add(mesh);
      this.itemMeshes.set(item.id, mesh);
    });
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      
      if (e.key.toLowerCase() === 'e') {
        this.interact();
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

  private updatePlayer(delta: number) {
    const speed = 5;
    const direction = new THREE.Vector3();

    if (this.keys.has('w') || this.keys.has('arrowup')) direction.z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) direction.z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) direction.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();
      this.playerVelocity.copy(direction).multiplyScalar(speed * delta);
      this.playerPosition.add(this.playerVelocity);

      // Keep player in bounds
      this.playerPosition.x = Math.max(-22, Math.min(22, this.playerPosition.x));
      this.playerPosition.z = Math.max(-22, Math.min(22, this.playerPosition.z));

      this.player.position.copy(this.playerPosition);
      
      // Gentle bobbing when moving
      this.player.position.y = Math.sin(Date.now() * 0.005) * 0.1;
      
      // Look in movement direction
      this.player.lookAt(
        this.playerPosition.x + direction.x,
        0,
        this.playerPosition.z + direction.z
      );
    }

    // Update camera to follow player
    this.camera.position.x = this.playerPosition.x;
    this.camera.position.z = this.playerPosition.z + 12;
    this.camera.lookAt(this.playerPosition.x, 0, this.playerPosition.z);

    // Check nearby characters and items
    this.checkNearbyInteractables();
  }

  private checkNearbyInteractables() {
    const interactionDistance = 2;
    let closestChar: Character | null = null;
    let closestDist = interactionDistance;

    this.characters.forEach((mesh, id) => {
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
      if (!item.collected) {
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
      // Gentle bobbing
      const time = Date.now() * 0.001;
      mesh.position.y = Math.sin(time + mesh.userData.bobOffset) * 0.05;
    });
  }

  private updateItems(delta: number) {
    this.itemMeshes.forEach(mesh => {
      if (!mesh.userData.item.collected) {
        mesh.rotation.y += delta * mesh.userData.rotationSpeed;
        mesh.position.y = 0.25 + Math.sin(Date.now() * 0.002) * 0.1;
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
        vector.y += 2;
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
    
    this.updatePlayer(delta);
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
