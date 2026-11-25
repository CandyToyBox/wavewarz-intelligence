import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ARTIST_LOSE_SPLIT,
  ARTIST_WIN_SPLIT,
  PLATFORM_SPLIT,
  type RacerArenaDynamics,
  type Side,
  type SurferStyle,
  type TrickType,
  clamp,
  computeRacerArenaDynamics,
  getSurferTier,
} from "@/lib/games/battle-logic";
import type { ArenaEngine, ArenaTriggerPayload } from "./arenaTypes";
import {
  type RacerPodInstance,
  createRacerPod,
  disposeRacerPod,
  setRacerFlip,
  setRacerStyle,
  updateRacerAlbumTexture,
  updateRacerTierWearables,
} from "./racerPodBuilder";

interface ActiveAction {
  type: TrickType;
  startSec: number;
  durationSec: number;
  power01: number;
  isFinale?: boolean;
}

interface RacerRuntimeState {
  side: Side;
  pod: RacerPodInstance;
  pool: number;
  targetScale: number;
  currentScale: number;
  surgeZ: number;
  rollAngle: number;
  pitchAngle: number;
  airBrakeDeploy: number;
  nitroBoost: number;
  activeAction: ActiveAction | null;
  level: number;
  baseX: number;
  baseZ: number;
  isWinner: boolean;
  isRunnerUp: boolean;
}

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  color: THREE.Color;
}

interface SonicRing {
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  maxRadius: number;
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

const MAX_SPARKS = 80;
const MAX_SONIC_RINGS = 8;
const MAX_VAULT_COINS = 48;
const TUNNEL_RING_COUNT = 18;
const TRACK_LENGTH = 140;

export class RacerArenaEngine implements ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private isDisposed = false;

  private clock = new THREE.Clock();
  private totalElapsed = 0;
  private lastTime = 0;

  private racerA: RacerRuntimeState;
  private racerB: RacerRuntimeState;
  private dynamics: RacerArenaDynamics = computeRacerArenaDynamics(0, 0);

  // Environmental meshes
  private trackMesh: THREE.Mesh;
  private trackMaterial: THREE.MeshBasicMaterial;
  private trackRails: THREE.LineSegments;
  private tunnelRings: THREE.Group[] = [];
  private starsPoints: THREE.Points;
  private finishGateGroup: THREE.Group;
  private finishGateLaserMat: THREE.MeshBasicMaterial;

  // Particle systems
  private sparks: SparkParticle[] = [];
  private sparkPoints!: THREE.Points;
  private sparkGeom!: THREE.BufferGeometry;
  private sparkPosAttr!: THREE.BufferAttribute;
  private sparkColAttr!: THREE.BufferAttribute;

  private sonicRings: SonicRing[] = [];
  private sonicRingMeshes: THREE.Mesh[] = [];

  private vaultCoins: VaultCoin[] = [];
  private coinInstancedMesh!: THREE.InstancedMesh;
  private coinDummy = new THREE.Object3D();

  // Scratch objects for zero-GC loops
  private scratchPos = new THREE.Vector3();
  private scratchRot = new THREE.Euler();
  private scratchColor = new THREE.Color();

  constructor(
    container: HTMLElement,
    photoA: string | HTMLCanvasElement,
    photoB: string | HTMLCanvasElement,
    styleA: SurferStyle = "pro",
    styleB: SurferStyle = "queen",
  ) {
    this.container = container;

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040813);
    this.scene.fog = new THREE.FogExp2(0x040813, 0.018);

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
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !isSoftware;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 2. Camera Setup — Tight chase-cam so album-art pilots stay big and readable!
    // Chase camera is closely behind the dual racers, slightly elevated
    const aspect = (container.clientWidth || 800) / (container.clientHeight || 500);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.2, 220);
    this.camera.position.set(0, 2.05, 5.2);
    this.camera.lookAt(0, 1.25, -6.0);

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x223355, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    dirLight.position.set(4, 12, 6);
    dirLight.castShadow = !isSoftware;
    if (dirLight.castShadow) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 30;
      dirLight.shadow.bias = -0.0004;
    }
    this.scene.add(dirLight);

    const roomEnv = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(roomEnv).texture;
    pmremGenerator.dispose();

    // 4. Procedural Waveform Track & Parallax Tunnel
    const trackWidth = 7.2;
    const trackGeom = new THREE.PlaneGeometry(trackWidth, TRACK_LENGTH, 1, 64);
    trackGeom.rotateX(-Math.PI / 2);

    // Track procedural texture with neon grid stripes
    const trackCanvas = document.createElement("canvas");
    trackCanvas.width = 512;
    trackCanvas.height = 512;
    const tCtx = trackCanvas.getContext("2d");
    if (tCtx) {
      tCtx.fillStyle = "#030712";
      tCtx.fillRect(0, 0, 512, 512);

      // Neon center dashed line
      tCtx.strokeStyle = "#38bdf8";
      tCtx.lineWidth = 6;
      tCtx.setLineDash([32, 24]);
      tCtx.beginPath();
      tCtx.moveTo(256, 0);
      tCtx.lineTo(256, 512);
      tCtx.stroke();
      tCtx.setLineDash([]);

      // Lateral waveform grid lines
      tCtx.strokeStyle = "rgba(126, 193, 251, 0.15)";
      tCtx.lineWidth = 1.5;
      for (let y = 0; y < 512; y += 32) {
        tCtx.beginPath();
        tCtx.moveTo(0, y);
        tCtx.lineTo(512, y);
        tCtx.stroke();
      }

      // Outer track border lines
      tCtx.strokeStyle = "#7ec1fb";
      tCtx.lineWidth = 8;
      tCtx.strokeRect(4, 0, 504, 512);
    }
    const trackTex = new THREE.CanvasTexture(trackCanvas);
    trackTex.wrapS = THREE.RepeatWrapping;
    trackTex.wrapT = THREE.RepeatWrapping;
    trackTex.repeat.set(1, 14);

    this.trackMaterial = new THREE.MeshBasicMaterial({
      map: trackTex,
      side: THREE.DoubleSide,
    });
    this.trackMesh = new THREE.Mesh(trackGeom, this.trackMaterial);
    this.trackMesh.position.set(0, 0, -TRACK_LENGTH / 2 + 10);
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    // Neon Guard Rail Lines along track edges
    const railPositions: number[] = [];
    for (let i = 0; i < 40; i++) {
      const z1 = 10 - (i / 40) * TRACK_LENGTH;
      const z2 = 10 - ((i + 1) / 40) * TRACK_LENGTH;
      // Left rail
      railPositions.push(-trackWidth / 2, 0.25, z1, -trackWidth / 2, 0.25, z2);
      // Right rail
      railPositions.push(trackWidth / 2, 0.25, z1, trackWidth / 2, 0.25, z2);
    }
    const railGeom = new THREE.BufferGeometry();
    railGeom.setAttribute("position", new THREE.Float32BufferAttribute(railPositions, 3));
    const railMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    this.trackRails = new THREE.LineSegments(railGeom, railMat);
    this.scene.add(this.trackRails);

    // Parallax Tunnel Neon Rings
    const ringGeom = new THREE.TorusGeometry(5.4, 0.08, 6, 24);
    for (let i = 0; i < TUNNEL_RING_COUNT; i++) {
      const ringGroup = new THREE.Group();
      const ringColor = i % 2 === 0 ? 0x7ec1fb : 0x95fe7c;
      const ringMat = new THREE.MeshBasicMaterial({ color: ringColor });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringGroup.add(ringMesh);
      ringGroup.position.set(0, 2.2, 10 - i * 8.5);
      this.scene.add(ringGroup);
      this.tunnelRings.push(ringGroup);
    }

    // Distant Starfield
    const starCount = 380;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 120;
      starPositions[i * 3 + 1] = Math.random() * 60 + 2;
      starPositions[i * 3 + 2] = -Math.random() * 150 - 10;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.8,
      sizeAttenuation: true,
    });
    this.starsPoints = new THREE.Points(starGeom, starMat);
    this.scene.add(this.starsPoints);

    // 5. Finish Gate (Checkerboard Laser Archway)
    this.finishGateGroup = new THREE.Group();
    this.finishGateGroup.visible = false;
    this.finishGateGroup.position.set(0, 0, -3.8);

    const gatePillarGeom = new THREE.CylinderGeometry(0.24, 0.32, 6.5, 8);
    const gatePillarMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.9,
      roughness: 0.15,
    });
    const leftPillar = new THREE.Mesh(gatePillarGeom, gatePillarMat);
    leftPillar.position.set(-trackWidth / 2 - 0.4, 3.25, 0);
    this.finishGateGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(gatePillarGeom, gatePillarMat);
    rightPillar.position.set(trackWidth / 2 + 0.4, 3.25, 0);
    this.finishGateGroup.add(rightPillar);

    // Cross arch truss
    const archGeom = new THREE.BoxGeometry(trackWidth + 1.2, 0.55, 0.55);
    const archMesh = new THREE.Mesh(archGeom, gatePillarMat);
    archMesh.position.set(0, 6.2, 0);
    this.finishGateGroup.add(archMesh);

    // Laser checkerboard curtain
    const laserCurtainGeom = new THREE.PlaneGeometry(trackWidth, 4.5);
    laserCurtainGeom.translate(0, 2.5, 0);
    this.finishGateLaserMat = new THREE.MeshBasicMaterial({
      color: 0xe5c25a,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const laserCurtain = new THREE.Mesh(laserCurtainGeom, this.finishGateLaserMat);
    this.finishGateGroup.add(laserCurtain);
    this.scene.add(this.finishGateGroup);

    // 6. Build Dual Racers
    const podA = createRacerPod("A", styleA, photoA);
    const podB = createRacerPod("B", styleB, photoB);

    this.racerA = {
      side: "A",
      pod: podA,
      pool: 0,
      targetScale: 1.0,
      currentScale: 1.0,
      surgeZ: 0,
      rollAngle: 0,
      pitchAngle: 0,
      airBrakeDeploy: 0,
      nitroBoost: 0,
      activeAction: null,
      level: 1,
      baseX: -1.65,
      baseZ: 0,
      isWinner: false,
      isRunnerUp: false,
    };

    this.racerB = {
      side: "B",
      pod: podB,
      pool: 0,
      targetScale: 1.0,
      currentScale: 1.0,
      surgeZ: 0,
      rollAngle: 0,
      pitchAngle: 0,
      airBrakeDeploy: 0,
      nitroBoost: 0,
      activeAction: null,
      level: 1,
      baseX: 1.65,
      baseZ: 0,
      isWinner: false,
      isRunnerUp: false,
    };

    podA.parts.root.position.set(this.racerA.baseX, 0, this.racerA.baseZ);
    podB.parts.root.position.set(this.racerB.baseX, 0, this.racerB.baseZ);
    this.scene.add(podA.parts.root);
    this.scene.add(podB.parts.root);

    // 7. Initialize Particle Systems (Sparks, Sonic Rings, Coins)
    this.initParticleSystems();

    // 8. Event Listeners
    window.addEventListener("resize", this.handleResize);

    // 9. Start Animation Loop
    this.lastTime = performance.now();
    this.tick();
  }

  private initParticleSystems(): void {
    // Air-brake spark particles
    this.sparkGeom = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(MAX_SPARKS * 3);
    const sparkColors = new Float32Array(MAX_SPARKS * 3);
    this.sparkPosAttr = new THREE.BufferAttribute(sparkPositions, 3);
    this.sparkColAttr = new THREE.BufferAttribute(sparkColors, 3);
    this.sparkGeom.setAttribute("position", this.sparkPosAttr);
    this.sparkGeom.setAttribute("color", this.sparkColAttr);

    const sparkMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkPoints = new THREE.Points(this.sparkGeom, sparkMat);
    this.scene.add(this.sparkPoints);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0.5,
        color: new THREE.Color(),
      });
    }

    // Sonic Boom Shockwave Rings
    const sonicGeom = new THREE.RingGeometry(0.3, 0.45, 32);
    for (let i = 0; i < MAX_SONIC_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7ec1fb,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(sonicGeom, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sonicRingMeshes.push(mesh);
      this.sonicRings.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        age: 0,
        life: 0.6,
        maxRadius: 3.5,
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
        fromY: 0,
        fromZ: 0,
        toX: 0,
        toY: 0,
        toZ: 0,
        arcHeight: 2.5,
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
    this.racerA.pool = Math.max(0, Number.isFinite(poolA) ? poolA : 0);
    this.racerB.pool = Math.max(0, Number.isFinite(poolB) ? poolB : 0);

    const tierA = getSurferTier(this.racerA.pool);
    const tierB = getSurferTier(this.racerB.pool);

    this.racerA.targetScale = tierA.scale;
    this.racerA.level = tierA.level;
    updateRacerTierWearables(this.racerA.pod, tierA.wearables);

    this.racerB.targetScale = tierB.scale;
    this.racerB.level = tierB.level;
    updateRacerTierWearables(this.racerB.pod, tierB.wearables);

    this.dynamics = computeRacerArenaDynamics(this.racerA.pool, this.racerB.pool);
  }

  public triggerTrick(payload: ArenaTriggerPayload): void {
    const racer = payload.side === "A" ? this.racerA : this.racerB;
    const startSec = this.totalElapsed;
    const durationSec = Math.max(0.4, payload.durationMs / 1000);

    racer.activeAction = {
      type: payload.trick,
      startSec,
      durationSec,
      power01: payload.power01,
      isFinale: false,
    };

    if (payload.trick === "wipeoutWobble") {
      // Air-brake deploy & friction sparks
      racer.airBrakeDeploy = 1.0;
      racer.surgeZ = 0.85; // drops back along Z
      this.spawnSparks(racer.baseX, 0.45, racer.baseZ + 0.5, 36);
    } else {
      // Nitro Boost
      racer.nitroBoost = 1.0 + payload.power01 * 1.5;
      racer.surgeZ = -0.75 - payload.power01 * 0.85; // lunges forward along Z

      if (payload.trick === "spin360" || payload.trick === "megaTsunami") {
        this.spawnSonicRing(
          racer.baseX,
          0.8,
          racer.baseZ - 0.5,
          payload.side === "A" ? 0x7ec1fb : 0x95fe7c,
        );
      }
    }
  }

  public triggerGrandFinale(winner: Side | "tie"): void {
    this.finishGateGroup.visible = true;

    if (winner === "A") {
      this.racerA.isWinner = true;
      this.racerA.isRunnerUp = false;
      this.racerB.isWinner = false;
      this.racerB.isRunnerUp = true;
      this.racerA.nitroBoost = 2.0;
      this.racerA.surgeZ = -2.2;
    } else if (winner === "B") {
      this.racerB.isWinner = true;
      this.racerB.isRunnerUp = false;
      this.racerA.isWinner = false;
      this.racerA.isRunnerUp = true;
      this.racerB.nitroBoost = 2.0;
      this.racerB.surgeZ = -2.2;
    } else {
      this.racerA.isWinner = false;
      this.racerB.isWinner = false;
      this.racerA.isRunnerUp = false;
      this.racerB.isRunnerUp = false;
    }
  }

  public triggerCoinSplit(winner: Side): void {
    const isWinA = winner === "A";
    const winX = isWinA ? this.racerA.baseX : this.racerB.baseX;
    const loseX = isWinA ? this.racerB.baseX : this.racerA.baseX;

    let idx = 0;
    // 5% Winner Artist lane (18 coins)
    for (let i = 0; i < 18 && idx < MAX_VAULT_COINS; i++, idx++) {
      this.vaultCoins[idx] = {
        active: true,
        delay: i * 0.035,
        elapsed: 0,
        duration: 1.15,
        fromX: 0,
        fromY: 3.2,
        fromZ: -3.8,
        toX: winX + (Math.random() - 0.5) * 0.4,
        toY: 0.6,
        toZ: 0,
        arcHeight: 2.8,
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
        fromY: 3.2,
        fromZ: -3.8,
        toX: loseX + (Math.random() - 0.5) * 0.4,
        toY: 0.6,
        toZ: 0.4,
        arcHeight: 2.4,
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
        fromY: 3.2,
        fromZ: -3.8,
        toX: (Math.random() - 0.5) * 0.8,
        toY: 3.8,
        toZ: 2.2,
        arcHeight: 3.2,
        spinSpeed: 12,
        phase: Math.random() * Math.PI * 2,
        scale: 1.0,
        color: new THREE.Color(0x38bdf8),
      };
    }
  }

  public setSurferPhoto(side: Side, source: string): void {
    const racer = side === "A" ? this.racerA : this.racerB;
    updateRacerAlbumTexture(racer.pod, source);
  }

  public setSurferFlip(side: Side, flipX: boolean): void {
    const racer = side === "A" ? this.racerA : this.racerB;
    setRacerFlip(racer.pod, flipX);
  }

  public setSurferStyle(side: Side, style: SurferStyle): void {
    const racer = side === "A" ? this.racerA : this.racerB;
    setRacerStyle(racer.pod, style);
  }

  public reset(): void {
    this.racerA.pool = 0;
    this.racerB.pool = 0;
    this.racerA.currentScale = 1.0;
    this.racerB.currentScale = 1.0;
    this.racerA.surgeZ = 0;
    this.racerB.surgeZ = 0;
    this.racerA.rollAngle = 0;
    this.racerB.rollAngle = 0;
    this.racerA.pitchAngle = 0;
    this.racerB.pitchAngle = 0;
    this.racerA.airBrakeDeploy = 0;
    this.racerB.airBrakeDeploy = 0;
    this.racerA.nitroBoost = 0;
    this.racerB.nitroBoost = 0;
    this.racerA.activeAction = null;
    this.racerB.activeAction = null;
    this.racerA.isWinner = false;
    this.racerB.isWinner = false;
    this.racerA.isRunnerUp = false;
    this.racerB.isRunnerUp = false;
    this.finishGateGroup.visible = false;

    // Reset particles
    for (const s of this.sparks) s.active = false;
    for (const r of this.sonicRings) r.active = false;
    for (const c of this.vaultCoins) c.active = false;
    this.coinInstancedMesh.count = 0;

    this.syncSurferPools(0, 0);
  }

  public getOceanWaveState() {
    return {
      wavePhase: this.totalElapsed * 3.5,
      amplitudeMultiplier: this.dynamics.trackSpeed,
      frequencyMultiplier: this.dynamics.tunnelParallax,
      speedMultiplier: this.dynamics.trackSpeed,
      roughness01: this.dynamics.heat01,
      poolDiff: this.dynamics.poolDiff,
      bankingAngle: this.dynamics.bankingAngle,
      leadDistance: this.dynamics.leadDistance,
      trackSpeed: this.dynamics.trackSpeed,
    };
  }

  private spawnSparks(x: number, y: number, z: number, count: number): void {
    let spawned = 0;
    for (let i = 0; i < MAX_SPARKS && spawned < count; i++) {
      if (!this.sparks[i].active) {
        const s = this.sparks[i];
        s.active = true;
        s.x = x + (Math.random() - 0.5) * 0.4;
        s.y = y + Math.random() * 0.3;
        s.z = z + Math.random() * 0.2;
        s.vx = (Math.random() - 0.5) * 2.8;
        s.vy = Math.random() * 2.4 + 0.8;
        s.vz = Math.random() * 3.5 + 2.0;
        s.age = 0;
        s.life = Math.random() * 0.35 + 0.25;
        s.color.setHex(Math.random() > 0.4 ? 0xffaa00 : 0xff3b30);
        spawned++;
      }
    }
  }

  private spawnSonicRing(x: number, y: number, z: number, hex: number): void {
    for (let i = 0; i < MAX_SONIC_RINGS; i++) {
      if (!this.sonicRings[i].active) {
        const r = this.sonicRings[i];
        r.active = true;
        r.x = x;
        r.y = y;
        r.z = z;
        r.age = 0;
        r.life = 0.55;
        r.maxRadius = 3.6;
        r.color.setHex(hex);
        break;
      }
    }
  }

  private tick = (): void => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const delta = Math.min(0.08, this.clock.getDelta());
    this.totalElapsed += delta;

    // 1. Procedural Track UV Scroll (Simulates Forward Hyper-Speed)
    const speed = this.dynamics.trackSpeed * 1.35;
    if (this.trackMaterial.map) {
      this.trackMaterial.map.offset.y = (this.trackMaterial.map.offset.y - delta * speed * 2.8) % 1;
    }

    // 2. Parallax Ring Portals Stream Backward Along Z
    const ringSpeed = delta * speed * 28.0;
    for (let i = 0; i < this.tunnelRings.length; i++) {
      const ring = this.tunnelRings[i];
      ring.position.z += ringSpeed;
      if (ring.position.z > 8.0) {
        ring.position.z -= TUNNEL_RING_COUNT * 8.5;
      }
      // Subtle pulse scale with pool heat
      const ringPulse = 1.0 + Math.sin(this.totalElapsed * 5.0 + i) * (0.04 * this.dynamics.heat01);
      ring.scale.set(ringPulse, ringPulse, 1.0);
    }

    // 3. Dynamic Banking: Camera rolls smoothly into curve
    const targetCamRoll = this.dynamics.bankingAngle * 0.45;
    this.camera.rotation.z += (targetCamRoll - this.camera.rotation.z) * (delta * 4.0);

    // 4. Update Dual Racers
    this.updateRacer(this.racerA, delta, true);
    this.updateRacer(this.racerB, delta, false);

    // 5. Update Particles
    this.updateSparks(delta);
    this.updateSonicRings(delta);
    this.updateVaultCoins(delta);

    // 6. Render Frame
    this.renderer.render(this.scene, this.camera);
  };

  private updateRacer(racer: RacerRuntimeState, delta: number, isSideA: boolean): void {
    // Smooth Scale Interpolation
    racer.currentScale += (racer.targetScale - racer.currentScale) * (delta * 3.5);
    racer.pod.parts.root.scale.setScalar(racer.currentScale);

    // Levitation Hover Wave Bob
    const hoverY = 0.48 + Math.sin(this.totalElapsed * 4.2 + (isSideA ? 0 : 1.5)) * 0.06;

    // Lead Distance along Z: Leader pulls ahead by up to +1.15m, trailer lags by -1.15m
    const targetLeadZ = isSideA ? -this.dynamics.leadDistance : this.dynamics.leadDistance;
    racer.baseZ += (targetLeadZ - racer.baseZ) * (delta * 3.2);

    // Smooth recovery of surge offsets
    racer.surgeZ += (0 - racer.surgeZ) * (delta * 2.8);
    racer.nitroBoost += (0 - racer.nitroBoost) * (delta * 3.5);
    racer.airBrakeDeploy += (0 - racer.airBrakeDeploy) * (delta * 4.5);

    // Dynamic Banking Roll on the vehicle chassis
    const trackRoll = this.dynamics.bankingAngle * 0.65;
    let trickRoll = 0;
    let trickPitch = 0;

    // Handle Active Trick Action
    if (racer.activeAction) {
      const act = racer.activeAction;
      const progress = clamp((this.totalElapsed - act.startSec) / act.durationSec, 0, 1);

      if (act.type === "spin360") {
        trickRoll = progress * Math.PI * 2 * (isSideA ? -1 : 1);
        trickPitch = Math.sin(progress * Math.PI) * 0.35;
      } else if (act.type === "megaTsunami") {
        trickRoll = progress * Math.PI * 4 * (isSideA ? -1 : 1);
        trickPitch = Math.sin(progress * Math.PI) * 0.55;
      } else if (act.type === "indyGrab") {
        trickPitch = -Math.sin(progress * Math.PI) * 0.38;
      } else if (act.type === "carve") {
        trickRoll = Math.sin(progress * Math.PI * 2) * 0.32;
      }

      if (progress >= 1.0) {
        racer.activeAction = null;
      }
    }

    // Set Final Pod Positions & Rotations
    racer.pod.parts.root.position.set(
      racer.baseX,
      hoverY,
      racer.baseZ + racer.surgeZ,
    );

    racer.pod.parts.chassis.rotation.z = trackRoll + trickRoll;
    racer.pod.parts.chassis.rotation.x = trickPitch;

    // Thruster Flare Cones: expand with nitro boost & base track speed
    const flareScaleZ = 1.0 + racer.nitroBoost * 2.2 + (this.dynamics.trackSpeed - 1.0) * 0.8;
    racer.pod.parts.leftThrusterCone.scale.set(1.0, 1.0, flareScaleZ);
    racer.pod.parts.rightThrusterCone.scale.set(1.0, 1.0, flareScaleZ);

    // Air-Brakes: pivot up during sell actions
    const brakeAngle = -racer.airBrakeDeploy * 0.72;
    racer.pod.parts.leftAirBrake.rotation.x = brakeAngle;
    racer.pod.parts.rightAirBrake.rotation.x = brakeAngle;
  }

  private updateSparks(delta: number): void {
    const pos = this.sparkPosAttr.array as Float32Array;
    const col = this.sparkColAttr.array as Float32Array;
    let activeCount = 0;

    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      if (!s.active) {
        pos[i * 3] = 0;
        pos[i * 3 + 1] = -100;
        pos[i * 3 + 2] = 0;
        continue;
      }

      s.age += delta;
      if (s.age >= s.life) {
        s.active = false;
        pos[i * 3] = 0;
        pos[i * 3 + 1] = -100;
        pos[i * 3 + 2] = 0;
        continue;
      }

      s.x += s.vx * delta;
      s.y += s.vy * delta;
      s.z += s.vz * delta;
      s.vy -= 9.8 * delta; // Gravity

      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;

      const alpha = 1.0 - s.age / s.life;
      col[i * 3] = s.color.r * alpha;
      col[i * 3 + 1] = s.color.g * alpha;
      col[i * 3 + 2] = s.color.b * alpha;
      activeCount++;
    }

    this.sparkPosAttr.needsUpdate = true;
    this.sparkColAttr.needsUpdate = true;
    this.sparkPoints.visible = activeCount > 0;
  }

  private updateSonicRings(delta: number): void {
    for (let i = 0; i < MAX_SONIC_RINGS; i++) {
      const r = this.sonicRings[i];
      const mesh = this.sonicRingMeshes[i];

      if (!r.active) {
        mesh.visible = false;
        continue;
      }

      r.age += delta;
      if (r.age >= r.life) {
        r.active = false;
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const progress = r.age / r.life;
      const currentRadius = 0.5 + progress * r.maxRadius;
      mesh.scale.set(currentRadius, currentRadius, 1.0);
      mesh.position.set(r.x, r.y, r.z);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(r.color);
      mat.opacity = (1.0 - progress) * 0.85;
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

      // Parabolic 3D Arc Trajectory
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

    disposeRacerPod(this.racerA.pod);
    disposeRacerPod(this.racerB.pod);

    this.trackMesh.geometry.dispose();
    this.trackMaterial.dispose();
    if (this.trackMaterial.map) this.trackMaterial.map.dispose();

    this.trackRails.geometry.dispose();
    (this.trackRails.material as THREE.Material).dispose();

    for (const ring of this.tunnelRings) {
      ring.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) (m.material as THREE.Material).dispose();
        }
      });
    }

    this.starsPoints.geometry.dispose();
    (this.starsPoints.material as THREE.Material).dispose();

    this.finishGateGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      }
    });

    this.sparkGeom.dispose();
    (this.sparkPoints.material as THREE.Material).dispose();

    for (const m of this.sonicRingMeshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }

    this.coinInstancedMesh.geometry.dispose();
    (this.coinInstancedMesh.material as THREE.Material).dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
