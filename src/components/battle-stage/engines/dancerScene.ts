import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  type DancerArenaDynamics,
  type Side,
  type SurferStyle,
  type TrickType,
  clamp,
  computeDancerArenaDynamics,
  getSurferTier,
} from "@/lib/games/battle-logic";
import type { ArenaEngine, ArenaTriggerPayload } from "./arenaTypes";
import {
  type DancerRigInstance,
  createDancerRig,
  disposeDancerRig,
  setComicBubbleText,
  setDancerFlip,
  setDancerStyle,
  updateDancerAlbumTexture,
  updateDancerTierWearables,
} from "./dancerRigBuilder";

interface ActiveAction {
  type: TrickType;
  startSec: number;
  durationSec: number;
  power01: number;
  isFinale?: boolean;
}

interface DancerRuntimeState {
  side: Side;
  rig: DancerRigInstance;
  pool: number;
  targetScale: number;
  currentScale: number;
  activeAction: ActiveAction | null;
  stumbleTimer: number;
  level: number;
  baseX: number;
  baseZ: number;
  isWinner: boolean;
  isRunnerUp: boolean;
  bubbleFade: number;
}

interface ConfettiPiece {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  age: number;
  life: number;
  color: THREE.Color;
}

interface VaultCoin {
  active: boolean;
  delay: number;
  elapsed: number;
  duration: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  arcHeight: number;
  spinSpeed: number;
  phase: number;
  scale: number;
  color: THREE.Color;
}

const TILE_GRID_SIZE = 8;
const MAX_CONFETTI = 100;
const MAX_VAULT_COINS = 48;

export class DancerArenaEngine implements ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private isDisposed = false;

  private clock = new THREE.Clock();
  private totalElapsed = 0;

  private dancerA: DancerRuntimeState;
  private dancerB: DancerRuntimeState;
  private dynamics: DancerArenaDynamics = computeDancerArenaDynamics(0, 0);

  // Environment meshes
  private floorTiles: THREE.Mesh[][] = [];
  private floorTileMats: THREE.MeshStandardMaterial[][] = [];
  private concretePillarL: THREE.Mesh;
  private concretePillarR: THREE.Mesh;
  private backWall: THREE.Mesh;
  private backWallCanvas: HTMLCanvasElement;
  private backWallCtx: CanvasRenderingContext2D | null;
  private backWallTex: THREE.CanvasTexture;

  // Central Rooftop Retro Boombox
  private boomboxGroup: THREE.Group;
  private leftSpeakerCone: THREE.Mesh;
  private rightSpeakerCone: THREE.Mesh;

  // Confetti & Coins
  private confetti: ConfettiPiece[] = [];
  private confettiInstancedMesh!: THREE.InstancedMesh;
  private confettiDummy = new THREE.Object3D();

  private vaultCoins: VaultCoin[] = [];
  private coinInstancedMesh!: THREE.InstancedMesh;
  private coinDummy = new THREE.Object3D();

  constructor(
    container: HTMLElement,
    photoA: string | HTMLCanvasElement,
    photoB: string | HTMLCanvasElement,
    styleA: SurferStyle = "pro",
    styleB: SurferStyle = "queen",
  ) {
    this.container = container;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);
    this.scene.fog = new THREE.FogExp2(0x070b14, 0.022);

    const isSoftware =
      typeof navigator !== "undefined" &&
      /swiftshader|llvmpipe|softpipe/i.test(navigator.userAgent);

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: !isSoftware,
      depth: true,
      stencil: false,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftware ? 1 : 1.75));
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !isSoftware;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(this.renderer.domElement);

    // 2. Camera: Street-Level Dynamic Lens
    const aspect = (container.clientWidth || 800) / (container.clientHeight || 500);
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.2, 160);
    this.camera.position.set(0, 2.35, 7.8);
    this.camera.lookAt(0, 1.85, 0);

    // 3. Lighting Setup: High-Contrast Pop-Art Comic Lighting
    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.4);
    this.scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xffffff, 3.2, 35, Math.PI / 4, 0.35, 1.2);
    mainSpot.position.set(0, 8.5, 5);
    mainSpot.target.position.set(0, 1.5, 0);
    mainSpot.castShadow = !isSoftware;
    this.scene.add(mainSpot);
    this.scene.add(mainSpot.target);

    // Side A Cyan Keylight
    const keyA = new THREE.PointLight(0x7ec1fb, 2.5, 12, 1.5);
    keyA.position.set(-4, 3.5, 2.5);
    this.scene.add(keyA);

    // Side B Lime Keylight
    const keyB = new THREE.PointLight(0x95fe7c, 2.5, 12, 1.5);
    keyB.position.set(4, 3.5, 2.5);
    this.scene.add(keyB);

    const roomEnv = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(roomEnv).texture;
    pmremGenerator.dispose();

    // 4. Brutalist Concrete Architectural Pillars
    const pillarGeom = new THREE.BoxGeometry(1.6, 9, 2.2);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.concretePillarL = new THREE.Mesh(pillarGeom, concreteMat);
    this.concretePillarL.position.set(-5.6, 4.0, -1.8);
    this.concretePillarL.castShadow = true;
    this.concretePillarL.receiveShadow = true;
    this.scene.add(this.concretePillarL);

    this.concretePillarR = new THREE.Mesh(pillarGeom, concreteMat);
    this.concretePillarR.position.set(5.6, 4.0, -1.8);
    this.concretePillarR.castShadow = true;
    this.concretePillarR.receiveShadow = true;
    this.scene.add(this.concretePillarR);

    // 5. Pop-Art Comic Halftone & Graffiti Billboard Backdrop
    this.backWallCanvas = document.createElement("canvas");
    this.backWallCanvas.width = 1024;
    this.backWallCanvas.height = 512;
    this.backWallCtx = this.backWallCanvas.getContext("2d");
    this.drawGraffitiWall(0);

    this.backWallTex = new THREE.CanvasTexture(this.backWallCanvas);
    const wallGeom = new THREE.PlaneGeometry(12.5, 6.2);
    const wallMat = new THREE.MeshBasicMaterial({
      map: this.backWallTex,
      side: THREE.DoubleSide,
    });
    this.backWall = new THREE.Mesh(wallGeom, wallMat);
    this.backWall.position.set(0, 3.1, -3.2);
    this.scene.add(this.backWall);

    // 6. Interactive 8x8 LED Dance Floor Tiles
    const tileSize = 0.95;
    const tileSpacing = 1.05;
    const tileGeom = new THREE.BoxGeometry(tileSize, 0.08, tileSize);

    for (let r = 0; r < TILE_GRID_SIZE; r++) {
      this.floorTiles[r] = [];
      this.floorTileMats[r] = [];
      for (let c = 0; c < TILE_GRID_SIZE; c++) {
        const x = (c - (TILE_GRID_SIZE - 1) / 2) * tileSpacing;
        const z = (r - (TILE_GRID_SIZE - 1) / 2) * tileSpacing;

        const mat = new THREE.MeshStandardMaterial({
          color: (r + c) % 2 === 0 ? 0x091428 : 0x07111f,
          emissive: (r + c) % 2 === 0 ? 0x7ec1fb : 0x95fe7c,
          emissiveIntensity: 0.22,
          roughness: 0.25,
          metalness: 0.65,
        });
        const tile = new THREE.Mesh(tileGeom, mat);
        tile.position.set(x, 0, z);
        tile.receiveShadow = true;
        this.scene.add(tile);

        this.floorTiles[r][c] = tile;
        this.floorTileMats[r][c] = mat;
      }
    }

    // 7. Central Rooftop Retro Boombox
    this.boomboxGroup = new THREE.Group();
    this.boomboxGroup.position.set(0, 1.15, -2.5);
    const boxBodyGeom = new THREE.BoxGeometry(2.4, 1.3, 0.7);
    const boxBodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.25,
    });
    const boxBody = new THREE.Mesh(boxBodyGeom, boxBodyMat);
    boxBody.castShadow = true;
    this.boomboxGroup.add(boxBody);

    // Boombox Handle
    const handleGeom = new THREE.BoxGeometry(1.6, 0.12, 0.12);
    handleGeom.translate(0, 0.85, 0);
    const handle = new THREE.Mesh(handleGeom, boxBodyMat);
    this.boomboxGroup.add(handle);

    // Left & Right Speaker Cones
    const speakerGeom = new THREE.CylinderGeometry(0.42, 0.32, 0.2, 16);
    speakerGeom.rotateX(Math.PI / 2);
    const speakerMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      emissive: 0x7ec1fb,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    this.leftSpeakerCone = new THREE.Mesh(speakerGeom, speakerMat);
    this.leftSpeakerCone.position.set(-0.68, 0, 0.3);
    this.boomboxGroup.add(this.leftSpeakerCone);

    const rightSpeakerMat = speakerMat.clone();
    rightSpeakerMat.emissive.setHex(0x95fe7c);
    this.rightSpeakerCone = new THREE.Mesh(speakerGeom, rightSpeakerMat);
    this.rightSpeakerCone.position.set(0.68, 0, 0.3);
    this.boomboxGroup.add(this.rightSpeakerCone);
    this.scene.add(this.boomboxGroup);

    // 8. Dual Stylized Vinyl Figures (Dancer A & Dancer B)
    const rigA = createDancerRig("A", styleA, photoA);
    const rigB = createDancerRig("B", styleB, photoB);

    this.dancerA = {
      side: "A",
      rig: rigA,
      pool: 0,
      targetScale: 1.0,
      currentScale: 1.0,
      activeAction: null,
      stumbleTimer: 0,
      level: 1,
      baseX: -1.75,
      baseZ: 0.3,
      isWinner: false,
      isRunnerUp: false,
      bubbleFade: 0,
    };

    this.dancerB = {
      side: "B",
      rig: rigB,
      pool: 0,
      targetScale: 1.0,
      currentScale: 1.0,
      activeAction: null,
      stumbleTimer: 0,
      level: 1,
      baseX: 1.75,
      baseZ: 0.3,
      isWinner: false,
      isRunnerUp: false,
      bubbleFade: 0,
    };

    rigA.parts.root.position.set(this.dancerA.baseX, 0, this.dancerA.baseZ);
    rigB.parts.root.position.set(this.dancerB.baseX, 0, this.dancerB.baseZ);
    this.scene.add(rigA.parts.root);
    this.scene.add(rigB.parts.root);

    // 9. Particle Systems (Comic Confetti & Vault Coins)
    this.initParticleSystems();

    // 10. Listeners & Animation
    window.addEventListener("resize", this.handleResize);
    this.tick();
  }

  private drawGraffitiWall(frame: number): void {
    const ctx = this.backWallCtx;
    if (!ctx) return;
    const w = 1024;
    const h = 512;

    // Dark brick/concrete backdrop
    ctx.fillStyle = "#070c17";
    ctx.fillRect(0, 0, w, h);

    // Pop-Art Ben-Day Halftone Dot Grid
    ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
    for (let x = 16; x < w; x += 32) {
      for (let y = 16; y < h; y += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Comic Equalizer Graphic Bars (Center)
    const barCount = 24;
    const barWidth = 18;
    const startX = w / 2 - (barCount * 28) / 2;
    for (let i = 0; i < barCount; i++) {
      const bh = 40 + Math.sin(frame * 0.06 + i * 0.45) * 35 + Math.random() * 25;
      const x = startX + i * 28;
      const grad = ctx.createLinearGradient(0, h / 2 - bh, 0, h / 2 + bh);
      grad.addColorStop(0, i < barCount / 2 ? "#7ec1fb" : "#95fe7c");
      grad.addColorStop(1, i < barCount / 2 ? "#f2a74b" : "#e5c25a");
      ctx.fillStyle = grad;
      ctx.fillRect(x, h / 2 - bh, barWidth, bh * 2);
    }

    // Bold Graffiti Stencil Headlines
    ctx.font = "900 68px 'Space Grotesk', 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.lineWidth = 8;
    ctx.strokeStyle = "#000000";
    ctx.strokeText("WAVEWARZ STREET CLASH", w / 2, 110);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("WAVEWARZ STREET CLASH", w / 2, 110);

    // Side A & Side B Graffiti Tags
    ctx.font = "900 42px 'Space Grotesk', 'Arial Black', sans-serif";
    ctx.fillStyle = "#7ec1fb";
    ctx.fillText("BEAT A // POP", 220, 420);

    ctx.fillStyle = "#95fe7c";
    ctx.fillText("BEAT B // GROOVE", 804, 420);
  }

  private initParticleSystems(): void {
    // Pop-art square confetti
    const confettiGeom = new THREE.PlaneGeometry(0.18, 0.18);
    const confettiMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    this.confettiInstancedMesh = new THREE.InstancedMesh(
      confettiGeom,
      confettiMat,
      MAX_CONFETTI,
    );
    this.confettiInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confettiInstancedMesh.count = 0;
    this.scene.add(this.confettiInstancedMesh);

    for (let i = 0; i < MAX_CONFETTI; i++) {
      this.confetti.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        age: 0,
        life: 2.5,
        color: new THREE.Color(),
      });
    }

    // Vault Coins
    const coinGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
    coinGeom.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xe5c25a,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xffaa00,
      emissiveIntensity: 0.35,
    });
    this.coinInstancedMesh = new THREE.InstancedMesh(coinGeom, coinMat, MAX_VAULT_COINS);
    this.coinInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinInstancedMesh.count = 0;
    this.scene.add(this.coinInstancedMesh);

    for (let i = 0; i < MAX_VAULT_COINS; i++) {
      this.vaultCoins.push({
        active: false,
        delay: 0,
        elapsed: 0,
        duration: 1.2,
        fromX: 0,
        fromY: 1.2,
        fromZ: -2.5,
        toX: 0,
        toY: 0,
        toZ: 0,
        arcHeight: 2.8,
        spinSpeed: 10,
        phase: Math.random() * Math.PI * 2,
        scale: 1,
        color: new THREE.Color(0xe5c25a),
      });
    }
  }

  private handleResize = (): void => {
    if (this.isDisposed || !this.container) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 500;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public syncSurferPools(poolA: number, poolB: number): void {
    this.dancerA.pool = Math.max(0, Number.isFinite(poolA) ? poolA : 0);
    this.dancerB.pool = Math.max(0, Number.isFinite(poolB) ? poolB : 0);

    const tierA = getSurferTier(this.dancerA.pool);
    const tierB = getSurferTier(this.dancerB.pool);

    this.dancerA.targetScale = tierA.scale;
    this.dancerA.level = tierA.level;
    updateDancerTierWearables(this.dancerA.rig, tierA.wearables);

    this.dancerB.targetScale = tierB.scale;
    this.dancerB.level = tierB.level;
    updateDancerTierWearables(this.dancerB.rig, tierB.wearables);

    this.dynamics = computeDancerArenaDynamics(this.dancerA.pool, this.dancerB.pool);
  }

  public triggerTrick(payload: ArenaTriggerPayload): void {
    const dancer = payload.side === "A" ? this.dancerA : this.dancerB;
    const startSec = this.totalElapsed;
    const durationSec = Math.max(0.4, payload.durationMs / 1000);

    dancer.activeAction = {
      type: payload.trick,
      startSec,
      durationSec,
      power01: payload.power01,
      isFinale: false,
    };

    dancer.bubbleFade = 1.0;
    dancer.rig.parts.comicBubbleGroup.visible = true;

    if (payload.trick === "wipeoutWobble") {
      dancer.stumbleTimer = 0.85;
      setComicBubbleText(dancer.rig, "WHOA!", "#ffffff", "#ef4444");
    } else if (payload.trick === "megaTsunami") {
      setComicBubbleText(dancer.rig, "BOOM!", "#ffffff", "#e5c25a");
    } else if (payload.trick === "spin360") {
      setComicBubbleText(dancer.rig, "SPIN!", "#000000", "#7ec1fb");
    } else if (payload.trick === "indyGrab") {
      setComicBubbleText(dancer.rig, "POW!", "#ffffff", "#f2a74b");
    } else {
      setComicBubbleText(dancer.rig, "GROOVE!", "#000000", "#95fe7c");
    }
  }

  public triggerGrandFinale(winner: Side | "tie"): void {
    if (winner === "A") {
      this.dancerA.isWinner = true;
      this.dancerA.isRunnerUp = false;
      this.dancerB.isWinner = false;
      this.dancerB.isRunnerUp = true;
      setComicBubbleText(this.dancerA.rig, "CHAMP!", "#ffffff", "#e5c25a");
      this.dancerA.rig.parts.comicBubbleGroup.visible = true;
      this.dancerA.bubbleFade = 1.0;
    } else if (winner === "B") {
      this.dancerB.isWinner = true;
      this.dancerB.isRunnerUp = false;
      this.dancerA.isWinner = false;
      this.dancerA.isRunnerUp = true;
      setComicBubbleText(this.dancerB.rig, "CHAMP!", "#ffffff", "#e5c25a");
      this.dancerB.rig.parts.comicBubbleGroup.visible = true;
      this.dancerB.bubbleFade = 1.0;
    } else {
      this.dancerA.isWinner = false;
      this.dancerB.isWinner = false;
      this.dancerA.isRunnerUp = false;
      this.dancerB.isRunnerUp = false;
    }

    this.spawnConfetti();
  }

  private spawnConfetti(): void {
    for (let i = 0; i < MAX_CONFETTI; i++) {
      const c = this.confetti[i];
      c.active = true;
      c.x = (Math.random() - 0.5) * 6;
      c.y = 5.5 + Math.random() * 2;
      c.z = (Math.random() - 0.5) * 4;
      c.vx = (Math.random() - 0.5) * 1.5;
      c.vy = -Math.random() * 2.2 - 1.2;
      c.vz = (Math.random() - 0.5) * 1.2;
      c.rx = Math.random() * Math.PI;
      c.ry = Math.random() * Math.PI;
      c.rz = Math.random() * Math.PI;
      c.age = 0;
      c.life = 3.2;
      const pick = Math.random();
      c.color.setHex(pick > 0.6 ? 0xe5c25a : pick > 0.3 ? 0x7ec1fb : 0xf2a74b);
    }
  }

  public triggerCoinSplit(winner: Side): void {
    const isWinA = winner === "A";
    const winX = isWinA ? this.dancerA.baseX : this.dancerB.baseX;
    const loseX = isWinA ? this.dancerB.baseX : this.dancerA.baseX;

    let idx = 0;
    // 5% Winner Artist lane (18 coins)
    for (let i = 0; i < 18 && idx < MAX_VAULT_COINS; i++, idx++) {
      this.vaultCoins[idx] = {
        active: true,
        delay: i * 0.035,
        elapsed: 0,
        duration: 1.15,
        fromX: 0,
        fromY: 1.4,
        fromZ: -2.5,
        toX: winX + (Math.random() - 0.5) * 0.5,
        toY: 0.4,
        toZ: 0.8,
        arcHeight: 3.2,
        spinSpeed: 14,
        phase: Math.random() * Math.PI * 2,
        scale: 1.1,
        color: new THREE.Color(0xe5c25a),
      };
    }

    // 2% Loser Artist lane (10 coins)
    for (let i = 0; i < 10 && idx < MAX_VAULT_COINS; i++, idx++) {
      this.vaultCoins[idx] = {
        active: true,
        delay: 0.12 + i * 0.04,
        elapsed: 0,
        duration: 1.25,
        fromX: 0,
        fromY: 1.4,
        fromZ: -2.5,
        toX: loseX + (Math.random() - 0.5) * 0.5,
        toY: 0.4,
        toZ: 0.8,
        arcHeight: 2.8,
        spinSpeed: 10,
        phase: Math.random() * Math.PI * 2,
        scale: 0.9,
        color: new THREE.Color(0x94a3b8),
      };
    }

    // 3% Platform Vault (12 coins)
    for (let i = 0; i < 12 && idx < MAX_VAULT_COINS; i++, idx++) {
      this.vaultCoins[idx] = {
        active: true,
        delay: 0.08 + i * 0.035,
        elapsed: 0,
        duration: 1.2,
        fromX: 0,
        fromY: 1.4,
        fromZ: -2.5,
        toX: (Math.random() - 0.5) * 0.8,
        toY: 4.2,
        toZ: 1.8,
        arcHeight: 3.6,
        spinSpeed: 12,
        phase: Math.random() * Math.PI * 2,
        scale: 1.0,
        color: new THREE.Color(0x7ec1fb),
      };
    }
  }

  public setSurferPhoto(side: Side, source: string): void {
    const dancer = side === "A" ? this.dancerA : this.dancerB;
    updateDancerAlbumTexture(dancer.rig, source);
  }

  public setSurferFlip(side: Side, flipX: boolean): void {
    const dancer = side === "A" ? this.dancerA : this.dancerB;
    setDancerFlip(dancer.rig, flipX);
  }

  public setSurferStyle(side: Side, style: SurferStyle): void {
    const dancer = side === "A" ? this.dancerA : this.dancerB;
    setDancerStyle(dancer.rig, style);
  }

  public reset(): void {
    this.dancerA.pool = 0;
    this.dancerB.pool = 0;
    this.dancerA.currentScale = 1.0;
    this.dancerB.currentScale = 1.0;
    this.dancerA.activeAction = null;
    this.dancerB.activeAction = null;
    this.dancerA.stumbleTimer = 0;
    this.dancerB.stumbleTimer = 0;
    this.dancerA.isWinner = false;
    this.dancerB.isWinner = false;
    this.dancerA.isRunnerUp = false;
    this.dancerB.isRunnerUp = false;
    this.dancerA.rig.parts.comicBubbleGroup.visible = false;
    this.dancerB.rig.parts.comicBubbleGroup.visible = false;

    for (const c of this.confetti) c.active = false;
    for (const v of this.vaultCoins) v.active = false;
    this.confettiInstancedMesh.count = 0;
    this.coinInstancedMesh.count = 0;

    this.syncSurferPools(0, 0);
  }

  public getOceanWaveState() {
    return {
      wavePhase: this.totalElapsed * 3.5,
      amplitudeMultiplier: this.dynamics.tilePulseSpeed,
      frequencyMultiplier: this.dynamics.tilePulseSpeed,
      speedMultiplier: this.dynamics.tilePulseSpeed,
      roughness01: this.dynamics.heat01,
      poolDiff: this.dynamics.poolDiff,
      bpm: this.dynamics.bpm,
      crowdGlow: this.dynamics.graffitiGlow,
    };
  }

  private tick = (): void => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const delta = Math.min(0.08, this.clock.getDelta());
    this.totalElapsed += delta;

    // 1. Dance Rhythm BPM Time
    const bps = this.dynamics.bpm / 60;
    const beatPhase = (this.totalElapsed * bps * Math.PI * 2) % (Math.PI * 2);

    // 2. Animate LED Floor Tiles (Ripple outward from dancers)
    this.updateFloorTiles(beatPhase);

    // 3. Boombox Speaker Cone Excursion
    const conePump = Math.max(0, Math.sin(beatPhase)) * 0.18 * this.dynamics.boomboxExcursion;
    this.leftSpeakerCone.position.z = 0.3 + conePump;
    this.rightSpeakerCone.position.z = 0.3 + conePump;

    // 4. Update Figures & Groove Dance Moves
    this.updateDancerAnimation(this.dancerA, delta, beatPhase, true);
    this.updateDancerAnimation(this.dancerB, delta, beatPhase, false);

    // 5. Update Particles
    this.updateConfetti(delta);
    this.updateVaultCoins(delta);

    // 6. Render
    this.renderer.render(this.scene, this.camera);
  };

  private updateFloorTiles(beatPhase: number): void {
    const pulseBase = (Math.sin(beatPhase) * 0.5 + 0.5) * 0.45;
    for (let r = 0; r < TILE_GRID_SIZE; r++) {
      for (let c = 0; c < TILE_GRID_SIZE; c++) {
        const mat = this.floorTileMats[r][c];
        const distFromCenter = Math.sqrt(
          Math.pow(r - 3.5, 2) + Math.pow(c - 3.5, 2),
        );
        const wave = Math.sin(distFromCenter * 1.4 - this.totalElapsed * 5.0 * this.dynamics.tilePulseSpeed);
        const intensity = clamp(pulseBase + wave * 0.35 + this.dynamics.heat01 * 0.45, 0.15, 1.2);
        mat.emissiveIntensity = intensity;
      }
    }
  }

  private updateDancerAnimation(
    dancer: DancerRuntimeState,
    delta: number,
    beatPhase: number,
    isSideA: boolean,
  ): void {
    dancer.currentScale += (dancer.targetScale - dancer.currentScale) * (delta * 3.5);
    dancer.rig.parts.root.scale.setScalar(dancer.currentScale);

    // Comic Bubble Fadeout
    if (dancer.bubbleFade > 0) {
      dancer.bubbleFade -= delta * 0.8;
      dancer.rig.parts.comicBubbleMat.opacity = clamp(dancer.bubbleFade, 0, 1);
      if (dancer.bubbleFade <= 0) {
        dancer.rig.parts.comicBubbleGroup.visible = false;
      }
    }

    const rig = dancer.rig.parts;

    // Check Stumble (from sell actions)
    if (dancer.stumbleTimer > 0) {
      dancer.stumbleTimer -= delta;
      const wobble = Math.sin(dancer.stumbleTimer * 24.0) * 0.35;
      rig.bodyGroup.rotation.z = wobble;
      rig.bodyGroup.position.y = -0.15;
      rig.leftArmGroup.rotation.z = 1.2;
      rig.rightArmGroup.rotation.z = -1.2;
      rig.headGroup.rotation.y = wobble * 0.5;
      return;
    }

    // Handle Active Trick Move
    if (dancer.activeAction) {
      const act = dancer.activeAction;
      const progress = clamp((this.totalElapsed - act.startSec) / act.durationSec, 0, 1);

      if (act.type === "spin360") {
        rig.bodyGroup.rotation.y = progress * Math.PI * 2 * (isSideA ? 1 : -1);
        rig.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.45;
        rig.leftArmGroup.rotation.z = 1.1;
        rig.rightArmGroup.rotation.z = -1.1;
      } else if (act.type === "megaTsunami") {
        // Breakdance Air-Flare / Freeze Pose
        const spin = progress * Math.PI * 3;
        rig.bodyGroup.rotation.y = spin;
        rig.bodyGroup.rotation.z = Math.sin(progress * Math.PI) * 0.6;
        rig.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.55;
      } else if (act.type === "indyGrab") {
        // Toprock Power Kick
        rig.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.35;
        rig.leftArmGroup.rotation.x = -1.2;
        rig.rightArmGroup.rotation.x = 1.2;
        rig.leftLegGroup.rotation.x = -0.8;
      } else if (act.type === "carve") {
        // Downrock Step Shuffle
        const step = Math.sin(progress * Math.PI * 4);
        rig.bodyGroup.position.x = step * 0.3;
        rig.headGroup.rotation.z = step * 0.2;
      }

      if (progress >= 1.0) {
        dancer.activeAction = null;
        rig.bodyGroup.rotation.set(0, 0, 0);
        rig.bodyGroup.position.set(0, 0, 0);
      }
      return;
    }

    // Default Stylized Vinyl Groove Dance
    // Head Bob
    const bob = Math.abs(Math.sin(beatPhase)) * 0.12;
    rig.bodyGroup.position.y = bob;
    rig.headGroup.position.y = 2.35 - bob * 0.5;
    rig.headGroup.rotation.z = Math.sin(beatPhase * 0.5) * 0.12;

    // Arm Swings
    const armSwing = Math.sin(beatPhase) * 0.42;
    rig.leftArmGroup.rotation.x = armSwing;
    rig.rightArmGroup.rotation.x = -armSwing;

    // Torso Sway & Leg Bends
    rig.bodyGroup.rotation.y = Math.sin(beatPhase * 0.5) * 0.18;
    rig.leftLegGroup.rotation.x = -armSwing * 0.4;
    rig.rightLegGroup.rotation.x = armSwing * 0.4;
  }

  private updateConfetti(delta: number): void {
    let count = 0;
    for (let i = 0; i < MAX_CONFETTI; i++) {
      const c = this.confetti[i];
      if (!c.active) continue;

      c.age += delta;
      if (c.age >= c.life) {
        c.active = false;
        continue;
      }

      c.x += c.vx * delta;
      c.y += c.vy * delta;
      c.z += c.vz * delta;
      c.rx += 4.0 * delta;
      c.ry += 3.0 * delta;

      this.confettiDummy.position.set(c.x, c.y, c.z);
      this.confettiDummy.rotation.set(c.rx, c.ry, c.rz);
      this.confettiDummy.scale.setScalar(1.0 - c.age / c.life);
      this.confettiDummy.updateMatrix();

      this.confettiInstancedMesh.setMatrixAt(count, this.confettiDummy.matrix);
      count++;
    }

    this.confettiInstancedMesh.count = count;
    if (count > 0) {
      this.confettiInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateVaultCoins(delta: number): void {
    let activeCoins = 0;
    for (let i = 0; i < MAX_VAULT_COINS; i++) {
      const c = this.vaultCoins[i];
      if (!c.active) continue;

      if (c.delay > 0) {
        c.delay -= delta;
        continue;
      }

      c.elapsed += delta;
      const t = clamp(c.elapsed / c.duration, 0, 1);
      if (t >= 1.0) {
        c.active = false;
        continue;
      }

      const currentX = THREE.MathUtils.lerp(c.fromX, c.toX, t);
      const currentZ = THREE.MathUtils.lerp(c.fromZ, c.toZ, t);
      const arc = 4 * t * (1 - t) * c.arcHeight;
      const currentY = THREE.MathUtils.lerp(c.fromY, c.toY, t) + arc;

      this.coinDummy.position.set(currentX, currentY, currentZ);
      this.coinDummy.rotation.set(
        t * c.spinSpeed + c.phase,
        t * c.spinSpeed * 0.7,
        0,
      );
      this.coinDummy.scale.setScalar(c.scale * (1.0 - t * 0.25));
      this.coinDummy.updateMatrix();

      this.coinInstancedMesh.setMatrixAt(activeCoins, this.coinDummy.matrix);
      activeCoins++;
    }

    this.coinInstancedMesh.count = activeCoins;
    if (activeCoins > 0) {
      this.coinInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    window.removeEventListener("resize", this.handleResize);

    disposeDancerRig(this.dancerA.rig);
    disposeDancerRig(this.dancerB.rig);

    this.backWall.geometry.dispose();
    (this.backWall.material as THREE.Material).dispose();
    this.backWallTex.dispose();

    for (let r = 0; r < TILE_GRID_SIZE; r++) {
      for (let c = 0; c < TILE_GRID_SIZE; c++) {
        this.floorTiles[r][c].geometry.dispose();
        this.floorTileMats[r][c].dispose();
      }
    }

    this.boomboxGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      }
    });

    this.concretePillarL.geometry.dispose();
    (this.concretePillarL.material as THREE.Material).dispose();
    this.concretePillarR.geometry.dispose();
    (this.concretePillarR.material as THREE.Material).dispose();

    this.confettiInstancedMesh.geometry.dispose();
    (this.confettiInstancedMesh.material as THREE.Material).dispose();

    this.coinInstancedMesh.geometry.dispose();
    (this.coinInstancedMesh.material as THREE.Material).dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
