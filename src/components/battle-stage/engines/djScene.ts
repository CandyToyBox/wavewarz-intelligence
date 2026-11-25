import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ARTIST_LOSE_SPLIT,
  ARTIST_WIN_SPLIT,
  type DjArenaDynamics,
  PLATFORM_SPLIT,
  type Side,
  type SurferStyle,
  type TrickType,
  type WearableId,
  clamp,
  computeDjArenaDynamics,
  getSurferTier,
} from "@/lib/games/battle-logic";
import {
  type DjTexturePack,
  type SceneTexturePack,
  createDjTexturePack,
  createSceneTexturePack,
} from "./proceduralTextures";
import type { ArenaEngine, ArenaTriggerPayload } from "./arenaTypes";
import {
  type DjRig,
  buildDjRig,
  disposeDjRig,
  setDjFlip,
  setDjStyle,
  updateDjAlbumTexture,
} from "./djRigBuilder";

interface ActiveAction {
  type: TrickType;
  startSec: number;
  durationSec: number;
  power01: number;
  isFinale?: boolean;
}

interface DjRuntimeState {
  side: Side;
  rig: DjRig;
  pool: number;
  targetScale: number;
  currentScale: number;
  surgeEnergy: number;
  scratchImpulse: number;
  powerDip: number;
  glitchTimer: number;
  platterAngle: number;
  activeAction: ActiveAction | null;
  level: number;
  baseX: number;
  baseZ: number;
  isWinner: boolean;
  isRunnerUp: boolean;
}

interface BassShockwave {
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  maxRadius: number;
  color: THREE.Color;
}

interface PyroSpark {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
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
  vrx: number;
  vry: number;
  age: number;
  life: number;
  color: THREE.Color;
}

interface CrowdMember {
  x: number;
  y: number;
  z: number;
  phase: number;
  sideBias: number;
  baseScaleY: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();

const SIDE_A_HEX = new THREE.Color(0x7ec1fb);
const SIDE_B_HEX = new THREE.Color(0x95fe7c);
const GOLD_HEX = new THREE.Color(0xe5c25a);
const PYRO_HOT_HEX = new THREE.Color(0xffa62b);
const PYRO_WHITE_HEX = new THREE.Color(0xfff1c9);
const RED_GLITCH_HEX = new THREE.Color(0xef4444);

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createBeamTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, "rgba(255,255,255,0.68)");
    grad.addColorStop(0.5, "rgba(220,248,255,0.22)");
    grad.addColorStop(1, "rgba(200,240,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVaultCoinGeometry(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.022),
    new THREE.Vector2(0.145, -0.022),
    new THREE.Vector2(0.16, -0.032),
    new THREE.Vector2(0.205, -0.032),
    new THREE.Vector2(0.22, -0.015),
    new THREE.Vector2(0.22, 0.015),
    new THREE.Vector2(0.205, 0.032),
    new THREE.Vector2(0.16, 0.032),
    new THREE.Vector2(0.145, 0.022),
    new THREE.Vector2(0.0, 0.022),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createLedWallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uBeatPhase: { value: 0 },
      uStrobe: { value: 0.2 },
      uPoolA: { value: 0 },
      uPoolB: { value: 0 },
      uSurgeA: { value: 0 },
      uSurgeB: { value: 0 },
      uGlitchA: { value: 0 },
      uGlitchB: { value: 0 },
      uClimax: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBeatPhase;
      uniform float uStrobe;
      uniform float uPoolA;
      uniform float uPoolB;
      uniform float uSurgeA;
      uniform float uSurgeB;
      uniform float uGlitchA;
      uniform float uGlitchB;
      uniform float uClimax;
      varying vec2 vUv;

      float hash1(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      void main() {
        vec2 grid = vec2(92.0, 42.0);
        vec2 cellId = floor(vUv * grid);
        vec2 cellUv = fract(vUv * grid);

        // Micro LED diode mask for authentic festival screen dot pitch
        float pixelMask = smoothstep(0.08, 0.24, cellUv.x) * smoothstep(0.92, 0.76, cellUv.x)
                        * smoothstep(0.08, 0.24, cellUv.y) * smoothstep(0.92, 0.76, cellUv.y);

        float cx = cellId.x / grid.x;
        float cy = cellId.y / grid.y;
        float isLeft = 1.0 - smoothstep(0.45, 0.55, cx);
        float isRight = smoothstep(0.45, 0.55, cx);
        float centerDist = abs(cx - 0.5) * 2.0;

        float beatPulse = 0.5 + 0.5 * sin(uBeatPhase);
        float fastBeat = pow(max(0.0, sin(uBeatPhase * 2.0)), 3.0);

        // Dynamic EQ spectrum height per LED column
        float freqSpec = 0.5 + 0.5 * sin(cx * 36.0 + uBeatPhase * 1.4) * cos(cx * 21.0 - uTime * 3.2);
        float energyA = clamp(0.18 + uPoolA * 0.58 + uSurgeA * 0.42, 0.14, 1.0);
        float energyB = clamp(0.18 + uPoolB * 0.58 + uSurgeB * 0.42, 0.14, 1.0);
        float barHeight = mix(energyA, energyB, smoothstep(0.35, 0.65, cx));
        float targetH = clamp(barHeight * (0.34 + freqSpec * 0.56) + fastBeat * 0.14, 0.08, 0.94);

        float eqLit = step(cy, targetH);
        float eqPeak = exp(-pow((cy - targetH) * 18.0, 2.0));

        // Swirling club laser wave arcs across upper dark LED canvas
        float arcWave = sin(cx * 14.0 - uBeatPhase + sin(cy * 6.0) * 0.8) * 0.12 + 0.62;
        float laserLine = exp(-pow((cy - arcWave) * 20.0, 2.0)) * (0.35 + 0.65 * beatPulse);

        // Center Sound Clash BPM ring emblem
        vec2 centerUv = vec2((vUv.x - 0.5) * 2.2, vUv.y - 0.56);
        float ringD = length(centerUv);
        float pulseRing = exp(-pow((ringD - (0.12 + fastBeat * 0.08)) * 32.0, 2.0));
        float innerCore = exp(-ringD * 7.5) * (0.4 + 0.6 * beatPulse);

        vec3 darkWall = vec3(0.012, 0.02, 0.044);
        vec3 colA = vec3(0.08, 0.66, 1.0);
        vec3 colB = vec3(0.08, 0.92, 0.54);
        vec3 sideCol = mix(colA, colB, smoothstep(0.34, 0.66, cx));

        vec3 litCol = darkWall;
        litCol += sideCol * (eqLit * (0.28 + cy * 0.45) + eqPeak * 0.72);
        litCol += sideCol * laserLine * 0.48;
        litCol += mix(vec3(0.35, 0.85, 1.0), vec3(1.0, 0.84, 0.25), uClimax) * (pulseRing * 0.75 + innerCore * 0.42);

        // Synchronized BPM Strobe accent bands along upper wall
        float strobeBand = exp(-pow((cy - 0.88) * 14.0, 2.0)) * fastBeat * uStrobe;
        litCol += vec3(0.82, 0.94, 1.0) * strobeBand * (0.45 + centerDist * 0.45);

        // Brief static glitch bands on Sell events
        float rowRand = hash1(floor(vUv.y * 42.0) + floor(uTime * 28.0));
        float glitchZone = isLeft * uGlitchA + isRight * uGlitchB;
        float glitchLine = step(0.65, rowRand) * glitchZone;
        litCol = mix(litCol, vec3(0.95, 0.22, 0.34), glitchLine * 0.72);

        // Final Climax Gold Wave
        litCol = mix(litCol, vec3(1.0, 0.82, 0.28) * (0.45 + 0.55 * eqLit), uClimax * 0.55);

        // Apply LED pixel pitch grid cleanly
        litCol *= mix(0.28, 1.0, pixelMask);
        gl_FragColor = vec4(litCol, 1.0);
      }
    `,
  });
}

export class DjArenaEngine implements ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private resizeObserver: ResizeObserver;
  private sceneTextures: SceneTexturePack;
  private djTextures: DjTexturePack;

  private simTimeSec = 0;
  private beatPhase = 0;
  private lastPerfMs = 0;
  private climaxTimerSec = 0;
  private cameraTrauma = 0;
  private frameHandle = 0;
  private timeoutHandle = 0;
  private disposed = false;

  private targetDynamics: DjArenaDynamics = computeDjArenaDynamics(0, 0);
  private currentBpm = 118;
  private currentStrobe = 0.18;
  private currentConeExcursion = 0.28;
  private currentCrowdGlow = 0.26;
  private currentSpinBoost = 1;

  private ledWallMaterial: THREE.ShaderMaterial;
  private centralCrossfaderKnob!: THREE.Mesh;
  private centralCoreRing!: THREE.Mesh;
  private centralVuBarsA: THREE.Mesh[] = [];
  private centralVuBarsB: THREE.Mesh[] = [];
  private strobePodMeshes: THREE.Mesh[] = [];

  private laserConesA: Array<{ mesh: THREE.Mesh; baseRotZ: number; phase: number }> = [];
  private laserConesB: Array<{ mesh: THREE.Mesh; baseRotZ: number; phase: number }> = [];

  private eqPillars!: THREE.InstancedMesh;
  private eqCount = 32;
  private eqLevels = new Float32Array(32);
  private eqCoords: Array<{ x: number; y: number; z: number }> = [];

  private crowdBodyMesh!: THREE.InstancedMesh;
  private crowdWandMesh!: THREE.InstancedMesh;
  private crowdMembers: CrowdMember[] = [];

  private shockwaveMeshes: THREE.Mesh[] = [];
  private shockwavePool: BassShockwave[] = [];

  private pyroMesh!: THREE.InstancedMesh;
  private pyroPool: PyroSpark[] = [];

  private coinMesh!: THREE.InstancedMesh;
  private coinPool: VaultCoin[] = [];

  private confettiMesh!: THREE.InstancedMesh;
  private confettiPool: ConfettiPiece[] = [];

  private djA: DjRuntimeState;
  private djB: DjRuntimeState;

  private spotlightA: THREE.PointLight;
  private spotlightB: THREE.PointLight;
  private mixerLight: THREE.PointLight;
  private climaxLight: THREE.PointLight;

  private disposables: Array<{ dispose: () => void }> = [];
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private baseCameraPos = new THREE.Vector3(0, 3.35, 10.6);
  private baseCameraLook = new THREE.Vector3(0, 1.56, -1.8);
  private currentCameraPos = new THREE.Vector3(0, 3.35, 10.6);
  private currentCameraLook = new THREE.Vector3(0, 1.56, -1.8);
  private targetCameraFov = 46;

  private contextLostHandler = (e: Event) => {
    e.preventDefault();
  };

  constructor(
    container: HTMLElement,
    initialArtA: string | HTMLCanvasElement | null,
    initialArtB: string | HTMLCanvasElement | null,
    styleA: SurferStyle = "pro",
    styleB: SurferStyle = "queen",
  ) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.addEventListener("webglcontextlost", this.contextLostHandler, false);
    this.container.appendChild(this.renderer.domElement);

    this.sceneTextures = createSceneTexturePack(this.maxAnisotropy);
    this.djTextures = createDjTexturePack(this.maxAnisotropy);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060f);
    this.scene.fog = new THREE.FogExp2(0x03060f, 0.024);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.2, 120);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.baseCameraLook);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Lighting Budget: 1 Hemisphere + 1 Directional (shadow) + 4 PointLights
    const hemi = new THREE.HemisphereLight(0x527cc0, 0x050914, 0.56);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xdcebff, 1.65);
    keyLight.position.set(8, 9, 7);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    this.spotlightA = new THREE.PointLight(0x7ec1fb, 3.6, 14, 1.5);
    this.spotlightA.position.set(-3.2, 4.4, 2.2);
    this.scene.add(this.spotlightA);

    this.spotlightB = new THREE.PointLight(0x95fe7c, 3.6, 14, 1.5);
    this.spotlightB.position.set(3.2, 4.4, 2.2);
    this.scene.add(this.spotlightB);

    this.mixerLight = new THREE.PointLight(0xe5c25a, 1.8, 9, 1.6);
    this.mixerLight.position.set(0, 2.2, 1.8);
    this.scene.add(this.mixerLight);

    this.climaxLight = new THREE.PointLight(0xe5c25a, 0, 22, 1.3);
    this.climaxLight.position.set(0, 5.2, 2.5);
    this.scene.add(this.climaxLight);

    // Stage Architecture
    this.buildStageFloor();
    this.ledWallMaterial = this.buildFestivalLedWall();
    this.buildOverheadTrussAndLasers();
    this.eqPillars = this.buildBackstageEqTowers();
    this.buildCentralMixerBridge();
    this.buildCrowdMatrix();

    // Two Stylized Robotic DJ Rigs + Angled Turntables + Rising Speaker Stacks
    const rigA = buildDjRig(
      "A",
      styleA,
      initialArtA,
      this.maxAnisotropy,
      this.djTextures,
      this.sceneTextures.neopreneBump,
      this.sceneTextures.armorAlbedo,
      this.sceneTextures.armorBump,
    );
    rigA.root.position.set(-2.55, 0, 0.72);
    rigA.root.rotation.y = 0.24;
    this.scene.add(rigA.root);

    const rigB = buildDjRig(
      "B",
      styleB,
      initialArtB,
      this.maxAnisotropy,
      this.djTextures,
      this.sceneTextures.neopreneBump,
      this.sceneTextures.armorAlbedo,
      this.sceneTextures.armorBump,
    );
    rigB.root.position.set(2.55, 0, 0.72);
    rigB.root.rotation.y = -0.24;
    this.scene.add(rigB.root);

    this.djA = {
      side: "A",
      rig: rigA,
      pool: 0,
      targetScale: 1,
      currentScale: 1,
      surgeEnergy: 0,
      scratchImpulse: 0,
      powerDip: 0,
      glitchTimer: 0,
      platterAngle: 0,
      activeAction: null,
      level: 1,
      baseX: -2.55,
      baseZ: 0.72,
      isWinner: false,
      isRunnerUp: false,
    };

    this.djB = {
      side: "B",
      rig: rigB,
      pool: 0,
      targetScale: 1,
      currentScale: 1,
      surgeEnergy: 0,
      scratchImpulse: 0,
      powerDip: 0,
      glitchTimer: 0,
      platterAngle: 0,
      activeAction: null,
      level: 1,
      baseX: 2.55,
      baseZ: 0.72,
      isWinner: false,
      isRunnerUp: false,
    };

    this.buildBassShockwavePool();
    this.pyroMesh = this.buildPyroPool();
    this.coinMesh = this.buildCoinPool();
    this.confettiMesh = this.buildConfettiPool();

    this.resize(width, height);
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, entry.contentRect.width);
        const h = Math.max(1, entry.contentRect.height);
        this.resize(w, h);
      }
    });
    this.resizeObserver.observe(container);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastPerfMs = performance.now();
    this.startLoop();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildStageFloor(): void {
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x3b5378,
        map: this.djTextures.stageFloorMap,
        roughness: 0.86,
        metalness: 0.08,
        envMapIntensity: 0.1,
      }),
    );
    const floor = new THREE.Mesh(this.track(new THREE.PlaneGeometry(46, 34)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.22;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const lineMatA = this.track(
      new THREE.MeshBasicMaterial({ color: 0x7ec1fb, transparent: true, opacity: 0.42 }),
    );
    const lineMatB = this.track(
      new THREE.MeshBasicMaterial({ color: 0x95fe7c, transparent: true, opacity: 0.42 }),
    );
    const goldFloorMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xe5c25a, transparent: true, opacity: 0.45 }),
    );

    const riserMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x0b1222,
        roughness: 0.36,
        metalness: 0.72,
      }),
    );

    // Wide mainstage riser platform framing both DJ booths, speaker stacks & center WaveVault mixer
    const stageDeck = new THREE.Mesh(this.track(new THREE.BoxGeometry(12.6, 0.28, 4.9)), riserMat);
    stageDeck.position.set(0, -0.12, 0.32);
    stageDeck.receiveShadow = true;
    this.scene.add(stageDeck);

    const stageFrontStrip = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(12.64, 0.055, 0.08)),
      goldFloorMat,
    );
    stageFrontStrip.position.set(0, 0.01, 2.78);
    this.scene.add(stageFrontStrip);

    // Front festival pit barricade rail separating stage apron from crowd
    const barrierRail = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(13.8, 0.05, 0.06)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x1a263a, metalness: 0.85, roughness: 0.3 })),
    );
    barrierRail.position.set(0, 0.08, 3.62);
    this.scene.add(barrierRail);

    // Team vinyl-turntable floor aura rings under each booth
    for (const [x, mat] of [
      [-2.55, lineMatA],
      [2.55, lineMatB],
    ] as const) {
      const outer = new THREE.Mesh(this.track(new THREE.RingGeometry(1.5, 1.58, 42)), mat);
      outer.rotation.x = -Math.PI / 2;
      outer.position.set(x, 0.025, 0.75);
      this.scene.add(outer);

      const inner = new THREE.Mesh(this.track(new THREE.RingGeometry(0.95, 1.0, 36)), mat);
      inner.rotation.x = -Math.PI / 2;
      inner.position.set(x, 0.025, 0.75);
      this.scene.add(inner);
    }
  }

  private buildFestivalLedWall(): THREE.ShaderMaterial {
    const frameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x0c1220,
        roughness: 0.38,
        metalness: 0.85,
      }),
    );
    const backing = new THREE.Mesh(this.track(new THREE.BoxGeometry(20.6, 8.2, 0.45)), frameMat);
    backing.position.set(0, 3.65, -10.8);
    this.scene.add(backing);

    const mat = this.track(createLedWallMaterial());
    const screen = new THREE.Mesh(this.track(new THREE.PlaneGeometry(19.6, 7.4)), mat);
    screen.position.set(0, 3.65, -10.52);
    this.scene.add(screen);

    // Flanking festival side-wing speaker banners & vertical neon stanchions framing arena edges
    for (const sideDir of [-1, 1] as const) {
      const wingPanel = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.8, 7.2, 0.35)), frameMat);
      wingPanel.position.set(sideDir * 11.4, 3.4, -9.2);
      wingPanel.rotation.y = -sideDir * 0.38;
      this.scene.add(wingPanel);

      const wingNeon = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.14, 6.4, 0.14)),
        this.track(
          new THREE.MeshBasicMaterial({
            color: sideDir < 0 ? 0x7ec1fb : 0x95fe7c,
            transparent: true,
            opacity: 0.72,
          }),
        ),
      );
      wingNeon.position.set(sideDir * 9.85, 3.35, -9.8);
      this.scene.add(wingNeon);
    }

    return mat;
  }

  private buildOverheadTrussAndLasers(): void {
    const trussMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x162033,
        roughness: 0.38,
        metalness: 0.86,
      }),
    );

    // Overhead mainstage gantry beam & side support towers
    const topBeam = new THREE.Mesh(this.track(new THREE.BoxGeometry(15.2, 0.36, 0.44)), trussMat);
    topBeam.position.set(0, 5.95, -4.2);
    this.scene.add(topBeam);

    for (const sideDir of [-1, 1] as const) {
      const col = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.4, 6.4, 0.44)), trussMat);
      col.position.set(sideDir * 7.4, 2.8, -4.2);
      this.scene.add(col);
    }

    // BPM Strobe Pod strips along the gantry
    const podGeo = this.track(new THREE.BoxGeometry(0.68, 0.16, 0.18));
    for (let i = 0; i < 6; i++) {
      const x = -5.0 + i * 2.0;
      const strobeMat = this.track(
        new THREE.MeshBasicMaterial({
          color: i < 3 ? 0x7ec1fb : 0x95fe7c,
          transparent: true,
          opacity: 0.55,
        }),
      );
      const pod = new THREE.Mesh(podGeo, strobeMat);
      pod.position.set(x, 5.72, -3.95);
      this.scene.add(pod);
      this.strobePodMeshes.push(pod);
    }

    // Sweeping Volumetric Laser Beam Cones
    const beamTex = this.track(createBeamTexture());
    const coneGeo = this.track(new THREE.CylinderGeometry(0.08, 1.35, 9.6, 14, 1, true));
    coneGeo.translate(0, -4.8, 0);

    for (let i = 0; i < 3; i++) {
      const coneMatA = this.track(
        new THREE.MeshBasicMaterial({
          map: beamTex,
          color: 0x7ec1fb,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const beamA = new THREE.Mesh(coneGeo, coneMatA);
      const baseRotZA = 0.25 + (i - 1) * 0.28;
      beamA.position.set(-4.6 + i * 1.4, 5.75, -3.9);
      beamA.rotation.x = 0.36;
      beamA.rotation.z = baseRotZA;
      this.scene.add(beamA);
      this.laserConesA.push({ mesh: beamA, baseRotZ: baseRotZA, phase: i * 1.3 });

      const coneMatB = this.track(
        new THREE.MeshBasicMaterial({
          map: beamTex,
          color: 0x95fe7c,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const beamB = new THREE.Mesh(coneGeo, coneMatB);
      const baseRotZB = -0.25 + (i - 1) * 0.28;
      beamB.position.set(4.6 - i * 1.4, 5.75, -3.9);
      beamB.rotation.x = 0.36;
      beamB.rotation.z = baseRotZB;
      this.scene.add(beamB);
      this.laserConesB.push({ mesh: beamB, baseRotZ: baseRotZB, phase: i * 1.3 + 0.8 });
    }
  }

  private buildBackstageEqTowers(): THREE.InstancedMesh {
    const pillarGeo = this.track(new THREE.BoxGeometry(0.24, 1.0, 0.24));
    pillarGeo.translate(0, 0.5, 0);
    const pillarMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x1e4e79,
        emissiveIntensity: 0.9,
        roughness: 0.24,
        metalness: 0.3,
      }),
    );

    const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, this.eqCount);
    pillars.frustumCulled = false;

    const half = this.eqCount / 2;
    this.eqCoords = [];
    for (let i = 0; i < this.eqCount; i++) {
      this.eqLevels[i] = 0.7;
      const isLeft = i < half;
      const localIdx = isLeft ? i : i - half;
      const t = localIdx / (half - 1);
      const x = isLeft ? -7.6 + t * 5.8 : 1.8 + t * 5.8;
      const z = -6.8 - Math.sin(t * Math.PI) * 1.4;
      this.eqCoords.push({ x, y: 0.0, z });

      _dummy.position.set(x, 0, z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1.0, 1);
      _dummy.updateMatrix();
      pillars.setMatrixAt(i, _dummy.matrix);
      pillars.setColorAt(i, isLeft ? SIDE_A_HEX : SIDE_B_HEX);
    }
    pillars.instanceMatrix.needsUpdate = true;
    if (pillars.instanceColor) pillars.instanceColor.needsUpdate = true;
    this.scene.add(pillars);
    return pillars;
  }

  private buildCentralMixerBridge(): void {
    const group = new THREE.Group();
    group.position.set(0, 0.96, 0.76);
    this.scene.add(group);

    const chassisMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x101829,
        roughness: 0.3,
        metalness: 0.82,
        clearcoat: 0.75,
      }),
    );
    const goldMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xe5c25a,
        emissive: 0xffb703,
        emissiveIntensity: 0.72,
        roughness: 0.16,
        metalness: 0.9,
      }),
    );

    // Pedestal stand
    const stand = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.32, 0.52, 0.88, 16)),
      chassisMat,
    );
    stand.position.y = -0.44;
    group.add(stand);

    // Tilted Central Mixer Housing
    const mixerHead = new THREE.Group();
    mixerHead.rotation.x = 0.34;
    group.add(mixerHead);

    const body = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.48, 0.14, 0.92)),
      chassisMat,
    );
    mixerHead.add(body);

    const trim = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.52, 0.04, 0.96)),
      goldMat,
    );
    trim.position.y = -0.02;
    mixerHead.add(trim);

    const face = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(1.4, 0.84)),
      this.track(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: this.djTextures.mixerFaceMap,
          roughness: 0.42,
          metalness: 0.35,
        }),
      ),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.072;
    mixerHead.add(face);

    // Glowing WaveVault Center Core Ring (origin of coin split stream)
    this.centralCoreRing = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.21, 0.024, 10, 28)),
      goldMat,
    );
    this.centralCoreRing.rotation.x = Math.PI / 2;
    this.centralCoreRing.position.set(0, 0.088, -0.06);
    mixerHead.add(this.centralCoreRing);

    // Central Crossfader Rail + Moving Golden Carriage
    const rail = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.84, 0.02, 0.045)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x050811, roughness: 0.6 })),
    );
    rail.position.set(0, 0.082, 0.24);
    mixerHead.add(rail);

    this.centralCrossfaderKnob = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.11, 0.065, 0.12)),
      goldMat,
    );
    this.centralCrossfaderKnob.position.set(0, 0.11, 0.24);
    mixerHead.add(this.centralCrossfaderKnob);

    // Dual Master VU LED Strips left/right of central core
    const vuGeo = this.track(new THREE.BoxGeometry(0.06, 0.022, 0.045));
    for (let i = 0; i < 6; i++) {
      const mA = new THREE.Mesh(
        vuGeo,
        this.track(new THREE.MeshBasicMaterial({ color: 0x7ec1fb })),
      );
      mA.position.set(-0.36, 0.084, 0.08 - i * 0.075);
      mixerHead.add(mA);
      this.centralVuBarsA.push(mA);

      const mB = new THREE.Mesh(
        vuGeo,
        this.track(new THREE.MeshBasicMaterial({ color: 0x95fe7c })),
      );
      mB.position.set(0.36, 0.084, 0.08 - i * 0.075);
      mixerHead.add(mB);
      this.centralVuBarsB.push(mB);
    }
  }

  private buildCrowdMatrix(): void {
    // Low-profile festival crowd silhouette border tucked along far lower vignette & outer arena wings
    const bodyGeo = this.track(new THREE.CapsuleGeometry(0.16, 0.18, 4, 8));
    bodyGeo.translate(0, 0.18, 0);
    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x050912,
        roughness: 0.9,
        metalness: 0.05,
        envMapIntensity: 0.15,
      }),
    );

    const wandGeo = this.track(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6));
    wandGeo.translate(0, 0.46, 0);
    const wandMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      }),
    );

    const coords: CrowdMember[] = [];
    // Lower edge crowd barrier rim (below stage apron so full booths & floor rings stay clean)
    for (const sideDir of [-1, 1] as const) {
      for (let i = 0; i < 16; i++) {
        const row = i % 2;
        const col = Math.floor(i / 2);
        const x = sideDir * (1.45 + col * 0.62 + (row === 1 ? 0.28 : 0));
        const z = 5.45 + row * 0.55;
        coords.push({
          x,
          y: -0.42,
          z,
          phase: i * 0.65 + (sideDir > 0 ? 1.0 : 0),
          sideBias: sideDir < 0 ? 0 : 1,
          baseScaleY: 0.82 + (i % 3) * 0.08,
        });
      }
      // Outer concert wings along dark floor borders
      for (let i = 0; i < 10; i++) {
        const x = sideDir * (6.45 + (i % 2) * 0.62);
        const z = -1.2 + Math.floor(i / 2) * 1.15;
        coords.push({
          x,
          y: -0.3,
          z,
          phase: i * 0.8 + (sideDir > 0 ? 1.4 : 0),
          sideBias: sideDir < 0 ? 0 : 1,
          baseScaleY: 0.84 + (i % 3) * 0.08,
        });
      }
    }

    this.crowdMembers = coords;
    this.crowdBodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, coords.length);
    this.crowdBodyMesh.frustumCulled = false;

    this.crowdWandMesh = new THREE.InstancedMesh(wandGeo, wandMat, coords.length);
    this.crowdWandMesh.frustumCulled = false;

    for (let i = 0; i < coords.length; i++) {
      const m = coords[i];
      _dummy.position.set(m.x, m.y, m.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, m.baseScaleY, 1);
      _dummy.updateMatrix();
      this.crowdBodyMesh.setMatrixAt(i, _dummy.matrix);
      this.crowdWandMesh.setMatrixAt(i, _dummy.matrix);
      this.crowdWandMesh.setColorAt(i, m.sideBias === 0 ? SIDE_A_HEX : SIDE_B_HEX);
    }
    this.crowdBodyMesh.instanceMatrix.needsUpdate = true;
    this.crowdWandMesh.instanceMatrix.needsUpdate = true;
    if (this.crowdWandMesh.instanceColor) this.crowdWandMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.crowdBodyMesh);
    this.scene.add(this.crowdWandMesh);
  }

  private buildBassShockwavePool(): void {
    const ringGeo = this.track(new THREE.TorusGeometry(1.0, 0.055, 8, 42));
    for (let i = 0; i < 12; i++) {
      const mat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0x7ec1fb,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaveMeshes.push(mesh);
      this.shockwavePool.push({
        active: false,
        x: 0,
        y: 0.8,
        z: 0.8,
        age: 0,
        life: 0.85,
        maxRadius: 3.4,
        color: new THREE.Color(0x7ec1fb),
      });
    }
  }

  private spawnBassShockwave(
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    maxRadius: number,
    life = 0.85,
  ): void {
    for (let i = 0; i < this.shockwavePool.length; i++) {
      const sw = this.shockwavePool[i];
      if (!sw.active) {
        sw.active = true;
        sw.x = x;
        sw.y = y;
        sw.z = z;
        sw.age = 0;
        sw.life = life;
        sw.maxRadius = maxRadius;
        sw.color.copy(color);
        return;
      }
    }
  }

  private buildPyroPool(): THREE.InstancedMesh {
    const count = 160;
    const geo = this.track(new THREE.OctahedronGeometry(0.065, 0));
    const mat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.pyroPool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 1,
        size: 1,
        color: new THREE.Color(0xe5c25a),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private spawnPyroJet(x: number, y: number, z: number, count: number, tint: THREE.Color): void {
    let spawned = 0;
    for (let i = 0; i < this.pyroPool.length && spawned < count; i++) {
      const p = this.pyroPool[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.25;
        p.y = y;
        p.z = z + (Math.random() - 0.5) * 0.25;
        p.vx = (Math.random() - 0.5) * 1.9;
        p.vy = 4.2 + Math.random() * 4.4;
        p.vz = (Math.random() - 0.5) * 1.5;
        p.age = 0;
        p.life = 0.75 + Math.random() * 0.75;
        p.size = 0.65 + Math.random() * 0.95;
        p.color.copy(Math.random() < 0.35 ? PYRO_WHITE_HEX : tint);
        spawned++;
      }
    }
  }

  private buildCoinPool(): THREE.InstancedMesh {
    const count = 96;
    const geo = this.track(createVaultCoinGeometry());
    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x3b2c06,
        emissiveIntensity: 0.48,
        roughness: 0.14,
        metalness: 0.94,
        clearcoat: 0.75,
        clearcoatRoughness: 0.08,
      }),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.coinPool.push({
        active: false,
        delay: 0,
        elapsed: 0,
        duration: 1.5,
        fromX: 0,
        fromY: 0,
        fromZ: 0,
        toX: 0,
        toY: 0,
        toZ: 0,
        arcHeight: 1.5,
        spinSpeed: 8,
        phase: 0,
        scale: 1,
        color: new THREE.Color(0xe5c25a),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private buildConfettiPool(): THREE.InstancedMesh {
    const count = 140;
    const geo = this.track(new THREE.PlaneGeometry(0.16, 0.085));
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.confettiPool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        age: 0,
        life: 3,
        color: new THREE.Color(0xe5c25a),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  public syncSurferPools(poolA: number, poolB: number): void {
    const applySide = (st: DjRuntimeState, pool: number) => {
      st.pool = Math.max(0, pool);
      const tier = getSurferTier(st.pool);
      st.level = tier.level;
      st.targetScale = 1.0 + (tier.scale - 1.0) * 0.55; // keep DJ behind console proportional!
      st.rig.wingPodActive = tier.level >= 2;
      st.rig.speakerStackHighActive = tier.level >= 4;
      (Object.keys(st.rig.wearables) as WearableId[]).forEach((wid) => {
        st.rig.wearables[wid].targetActive = tier.wearables.includes(wid);
      });
    };

    applySide(this.djA, poolA);
    applySide(this.djB, poolB);
    this.targetDynamics = computeDjArenaDynamics(poolA, poolB);
  }

  public getOceanWaveState() {
    return {
      wavePhase: this.beatPhase,
      amplitudeMultiplier: 1 + (this.currentBpm - 118) / 34,
      frequencyMultiplier: 1 + this.currentStrobe,
      speedMultiplier: this.currentSpinBoost,
      roughness01: this.targetDynamics.heat01,
      poolDiff: this.targetDynamics.poolDiff,
      bpm: Math.round(this.currentBpm),
      coneExcursion: Number(this.currentConeExcursion.toFixed(2)),
      crowdGlow: Number(this.currentCrowdGlow.toFixed(2)),
      strobeIntensity: Number(this.currentStrobe.toFixed(2)),
    };
  }

  public triggerTrick(payload: ArenaTriggerPayload): void {
    const st = payload.side === "A" ? this.djA : this.djB;
    const isBuy = payload.waveSurge > 0;
    const sideColor = payload.side === "A" ? SIDE_A_HEX : SIDE_B_HEX;

    st.activeAction = {
      type: payload.trick,
      startSec: this.simTimeSec,
      durationSec: Math.max(0.42, payload.durationMs / 1000),
      power01: payload.power01,
    };

    if (isBuy) {
      st.surgeEnergy = clamp(st.surgeEnergy + payload.power01 * 1.15, 0, 1.85);
      st.scratchImpulse = clamp(0.65 + payload.power01 * 0.85, 0.65, 1.5);
      this.cameraTrauma = clamp(this.cameraTrauma + payload.power01 * 0.34, 0, 0.72);

      // Spawn expanding Bass-Cannon Shockwave Ring(s) from speaker tower / turntable
      const ringCount = payload.power01 >= 0.6 ? 2 : 1;
      for (let r = 0; r < ringCount; r++) {
        this.spawnBassShockwave(
          st.baseX,
          1.15 + r * 0.2,
          1.2,
          r === 1 ? GOLD_HEX : sideColor,
          2.6 + payload.power01 * 2.1,
          0.78 + r * 0.16,
        );
      }
    } else {
      // Sell: Record needle skip + brief turntable power dip & static glitch
      st.powerDip = clamp(0.7 + payload.power01 * 0.4, 0.7, 1.1);
      st.glitchTimer = 0.56;
      st.surgeEnergy = Math.max(0, st.surgeEnergy - 0.5);
      this.spawnBassShockwave(st.baseX, 1.1, 1.0, RED_GLITCH_HEX, 1.85, 0.5);
    }
  }

  public triggerGrandFinale(winner: Side | "tie"): void {
    this.climaxTimerSec = 3.2;
    this.cameraTrauma = 0.68;

    this.djA.isWinner = winner === "A";
    this.djB.isWinner = winner === "B";
    this.djA.isRunnerUp = winner === "B";
    this.djB.isRunnerUp = winner === "A";

    const triggerCelebration = (st: DjRuntimeState) => {
      st.activeAction = {
        type: "grandFinale",
        startSec: this.simTimeSec,
        durationSec: 4.5,
        power01: 1,
        isFinale: true,
      };
      st.surgeEnergy = 1.6;
    };

    if (winner === "A" || winner === "tie") triggerCelebration(this.djA);
    if (winner === "B" || winner === "tie") triggerCelebration(this.djB);

    // Mainstage Pyro Cannons Eruption
    const pyroColor = winner === "A" ? SIDE_A_HEX : winner === "B" ? SIDE_B_HEX : GOLD_HEX;
    for (const px of [-3.6, -1.35, 1.35, 3.6]) {
      this.spawnPyroJet(px, 0.1, -0.4, 34, PYRO_HOT_HEX);
    }
    if (winner !== "tie") {
      const winX = winner === "A" ? -2.55 : 2.55;
      this.spawnPyroJet(winX - 0.9, 0.25, 0.4, 24, pyroColor);
      this.spawnPyroJet(winX + 0.9, 0.25, 0.4, 24, GOLD_HEX);
    }

    // Mainstage Confetti Drop from Overhead Rafters
    const originX = winner === "A" ? -2.1 : winner === "B" ? 2.1 : 0;
    const palette = [SIDE_A_HEX, SIDE_B_HEX, GOLD_HEX, new THREE.Color(0xffffff)];
    let spawned = 0;
    for (let i = 0; i < this.confettiPool.length && spawned < 115; i++) {
      const cf = this.confettiPool[i];
      cf.active = true;
      cf.x = originX + (Math.random() - 0.5) * 7.2;
      cf.y = 5.4 + Math.random() * 1.4;
      cf.z = (Math.random() - 0.5) * 3.8;
      cf.vx = (Math.random() - 0.5) * 2.8;
      cf.vy = -0.6 - Math.random() * 1.5;
      cf.vz = (Math.random() - 0.5) * 2.4;
      cf.rx = Math.random() * 6;
      cf.ry = Math.random() * 6;
      cf.rz = Math.random() * 6;
      cf.vrx = (Math.random() - 0.5) * 10;
      cf.vry = (Math.random() - 0.5) * 10;
      cf.age = 0;
      cf.life = 2.8 + Math.random() * 1.5;
      cf.color.copy(palette[spawned % palette.length]);
      spawned++;
    }
  }

  public triggerCoinSplit(winner: Side): void {
    const winIsA = winner === "A";
    // Coins stream out directly from the Central Mixer Faders toward the 3 Payout Zones
    const originX = 0;
    const originY = 1.04;
    const originZ = 0.85;

    const totalWinnerWeight = ARTIST_WIN_SPLIT;
    const totalLoserWeight = ARTIST_LOSE_SPLIT;
    const totalPlatformWeight = PLATFORM_SPLIT;
    const total = totalWinnerWeight + totalLoserWeight + totalPlatformWeight;

    const countWin = Math.round(92 * (totalWinnerWeight / total));
    const countLose = Math.round(92 * (totalLoserWeight / total));
    const countPlat = 92 - countWin - countLose;

    const leftArtistTarget = { x: -3.95, y: 2.85, z: 1.35 };
    const rightArtistTarget = { x: 3.95, y: 2.85, z: 1.35 };
    const platformTarget = { x: 0.0, y: 3.45, z: 1.0 };

    const winTarget = winIsA ? leftArtistTarget : rightArtistTarget;
    const loseTarget = winIsA ? rightArtistTarget : leftArtistTarget;
    const winColor = winIsA ? SIDE_A_HEX : SIDE_B_HEX;
    const loseColor = winIsA ? SIDE_B_HEX : SIDE_A_HEX;

    let idx = 0;
    const emitBatch = (
      count: number,
      target: { x: number; y: number; z: number },
      color: THREE.Color,
      baseDelay: number,
    ) => {
      for (let i = 0; i < count && idx < this.coinPool.length; i++) {
        const c = this.coinPool[idx++];
        c.active = true;
        c.delay = baseDelay + i * 0.016;
        c.elapsed = 0;
        c.duration = 1.45 + Math.random() * 0.35;
        c.fromX = originX + (Math.random() - 0.5) * 0.42;
        c.fromY = originY + (Math.random() - 0.5) * 0.14;
        c.fromZ = originZ + (Math.random() - 0.5) * 0.25;
        c.toX = target.x + (Math.random() - 0.5) * 0.52;
        c.toY = target.y + (Math.random() - 0.5) * 0.35;
        c.toZ = target.z + (Math.random() - 0.5) * 0.3;
        c.arcHeight = 0.95 + Math.random() * 1.15;
        c.spinSpeed = 9 + Math.random() * 9;
        c.phase = Math.random() * Math.PI * 2;
        c.scale = 1.18 + Math.random() * 0.35;
        c.color.copy(color);
      }
    };

    emitBatch(countWin, winTarget, winColor, 0);
    emitBatch(countLose, loseTarget, loseColor, 0.08);
    emitBatch(countPlat, platformTarget, GOLD_HEX, 0.14);
  }

  public setSurferPhoto(side: Side, source: string): void {
    const st = side === "A" ? this.djA : this.djB;
    updateDjAlbumTexture(st.rig, source, st.rig.flipX, this.maxAnisotropy);
  }

  public setSurferFlip(side: Side, flipX: boolean): void {
    const st = side === "A" ? this.djA : this.djB;
    setDjFlip(st.rig, flipX);
  }

  public setSurferStyle(side: Side, style: SurferStyle): void {
    const st = side === "A" ? this.djA : this.djB;
    setDjStyle(st.rig, style);
  }

  public reset(): void {
    this.climaxTimerSec = 0;
    this.cameraTrauma = 0;
    this.targetCameraFov = 46;
    this.ledWallMaterial.uniforms.uClimax.value = 0;

    [this.djA, this.djB].forEach((st) => {
      st.activeAction = null;
      st.surgeEnergy = 0;
      st.scratchImpulse = 0;
      st.powerDip = 0;
      st.glitchTimer = 0;
      st.isWinner = false;
      st.isRunnerUp = false;
    });
    this.syncSurferPools(0, 0);

    for (const sw of this.shockwavePool) sw.active = false;
    for (const p of this.pyroPool) p.active = false;
    for (const c of this.coinPool) c.active = false;
    for (const cf of this.confettiPool) cf.active = false;

    this.updateShockwaves(0.016);
    this.updatePyro(0.016);
    this.updateCoins(0.016);
    this.updateConfetti(0.016);
  }

  public resize(width: number, height: number): void {
    if (this.disposed || width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastPerfMs) / 1000));
      this.lastPerfMs = now;

      this.stepSimulation(rawDt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameHandle = requestAnimationFrame(tick);
      }
    };

    this.frameHandle = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== "function") {
      this.timeoutHandle = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.timeoutHandle = window.setTimeout(poll, 6);
      } else {
        if (sync) gl.deleteSync(sync);
        this.timeoutHandle = window.setTimeout(cb, 80);
      }
    };
    this.timeoutHandle = window.setTimeout(poll, 6);
  }

  private stepSimulation(dt: number): void {
    this.simTimeSec += dt;

    this.currentBpm = THREE.MathUtils.damp(this.currentBpm, this.targetDynamics.bpm, 3.2, dt);
    this.currentStrobe = THREE.MathUtils.damp(
      this.currentStrobe,
      this.targetDynamics.strobeIntensity,
      3.4,
      dt,
    );
    this.currentConeExcursion = THREE.MathUtils.damp(
      this.currentConeExcursion,
      this.targetDynamics.coneExcursion,
      3.8,
      dt,
    );
    this.currentCrowdGlow = THREE.MathUtils.damp(
      this.currentCrowdGlow,
      this.targetDynamics.crowdGlow,
      3.5,
      dt,
    );
    this.currentSpinBoost = THREE.MathUtils.damp(
      this.currentSpinBoost,
      this.targetDynamics.spinBoost,
      3.2,
      dt,
    );

    const beatsPerSec = this.currentBpm / 60;
    this.beatPhase += dt * beatsPerSec * Math.PI * 2;
    const beatHit = Math.pow(Math.max(0, Math.sin(this.beatPhase)), 3);

    if (this.climaxTimerSec > 0) {
      this.climaxTimerSec = Math.max(0, this.climaxTimerSec - dt);
      this.ledWallMaterial.uniforms.uClimax.value = clamp(this.climaxTimerSec / 2.2, 0, 1);
      this.climaxLight.intensity = clamp(this.climaxTimerSec * 3.8, 0, 11);
      if (this.climaxTimerSec > 1.0 && Math.random() < 0.22) {
        this.spawnPyroJet((Math.random() - 0.5) * 5.2, 0.15, -0.5, 4, PYRO_HOT_HEX);
      }
    } else {
      this.ledWallMaterial.uniforms.uClimax.value = THREE.MathUtils.damp(
        this.ledWallMaterial.uniforms.uClimax.value,
        0,
        4,
        dt,
      );
      this.climaxLight.intensity = THREE.MathUtils.damp(this.climaxLight.intensity, 0, 4, dt);
    }

    // Decay surges, scratch impulses, sell power dips & glitches smoothly
    for (const st of [this.djA, this.djB]) {
      st.surgeEnergy = THREE.MathUtils.damp(st.surgeEnergy, 0, 2.2, dt);
      st.scratchImpulse = THREE.MathUtils.damp(st.scratchImpulse, 0, 4.5, dt);
      st.powerDip = THREE.MathUtils.damp(st.powerDip, 0, 3.6, dt);
      st.glitchTimer = Math.max(0, st.glitchTimer - dt);
    }

    // Sync LED Wall Shader uniforms
    const wall = this.ledWallMaterial.uniforms;
    wall.uTime.value = this.simTimeSec;
    wall.uBeatPhase.value = this.beatPhase;
    wall.uStrobe.value = this.currentStrobe;
    wall.uPoolA.value = clamp(this.djA.pool / 65, 0, 1);
    wall.uPoolB.value = clamp(this.djB.pool / 65, 0, 1);
    wall.uSurgeA.value = this.djA.surgeEnergy;
    wall.uSurgeB.value = this.djB.surgeEnergy;
    wall.uGlitchA.value = this.djA.glitchTimer > 0 ? 1 : 0;
    wall.uGlitchB.value = this.djB.glitchTimer > 0 ? 1 : 0;

    // Central WaveVault Mixer Bridge Crossfader + VU Meters
    const poolSpreadNorm = clamp((this.djB.pool - this.djA.pool) / 45, -1, 1);
    this.centralCrossfaderKnob.position.x = THREE.MathUtils.damp(
      this.centralCrossfaderKnob.position.x,
      poolSpreadNorm * 0.34,
      6.5,
      dt,
    );
    this.centralCoreRing.rotation.z += dt * (1.2 + this.currentStrobe * 1.4);
    const vuLevelA = clamp(0.35 + wall.uPoolA.value * 0.55 + this.djA.surgeEnergy * 0.4 + beatHit * 0.15, 0, 1);
    const vuLevelB = clamp(0.35 + wall.uPoolB.value * 0.55 + this.djB.surgeEnergy * 0.4 + beatHit * 0.15, 0, 1);
    this.centralVuBarsA.forEach((b, idx) => {
      b.visible = idx / 5 <= vuLevelA;
    });
    this.centralVuBarsB.forEach((b, idx) => {
      b.visible = idx / 5 <= vuLevelB;
    });

    // Overhead Strobe Pods & Sweeping Stage Lasers
    this.strobePodMeshes.forEach((pod, idx) => {
      const m = pod.material as THREE.MeshBasicMaterial;
      const sideBoost = idx < 3 ? this.djA.surgeEnergy : this.djB.surgeEnergy;
      m.opacity = clamp(0.28 + beatHit * this.currentStrobe * 0.65 + sideBoost * 0.35, 0.2, 1);
    });

    this.laserConesA.forEach((item) => {
      const sweepSpeed = 1.1 + this.djA.surgeEnergy * 2.8 + this.currentStrobe * 1.1;
      item.mesh.rotation.z =
        item.baseRotZ + Math.sin(this.simTimeSec * sweepSpeed + item.phase) * (0.28 + this.djA.surgeEnergy * 0.34);
      const m = item.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = clamp(0.08 + this.currentStrobe * 0.14 + this.djA.surgeEnergy * 0.2, 0.05, 0.38);
    });
    this.laserConesB.forEach((item) => {
      const sweepSpeed = 1.1 + this.djB.surgeEnergy * 2.8 + this.currentStrobe * 1.1;
      item.mesh.rotation.z =
        item.baseRotZ + Math.cos(this.simTimeSec * sweepSpeed + item.phase) * (0.28 + this.djB.surgeEnergy * 0.34);
      const m = item.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = clamp(0.08 + this.currentStrobe * 0.14 + this.djB.surgeEnergy * 0.2, 0.05, 0.38);
    });

    this.spotlightA.intensity = clamp(
      (3.3 + this.djA.surgeEnergy * 2.4 + beatHit * this.currentStrobe * 1.4) * (1 - this.djA.powerDip * 0.65),
      0.8,
      7.2,
    );
    this.spotlightB.intensity = clamp(
      (3.3 + this.djB.surgeEnergy * 2.4 + beatHit * this.currentStrobe * 1.4) * (1 - this.djB.powerDip * 0.65),
      0.8,
      7.2,
    );

    this.updateDjKinematics(this.djA, dt, beatHit);
    this.updateDjKinematics(this.djB, dt, beatHit);
    this.updateBackstageEqTowers(dt, beatHit);
    this.updateCrowdMatrix(beatHit);
    this.updateShockwaves(dt);
    this.updatePyro(dt);
    this.updateCoins(dt);
    this.updateConfetti(dt);
    this.updateCamera(dt);
  }

  private updateDjKinematics(st: DjRuntimeState, dt: number, beatHit: number): void {
    const rig = st.rig;
    const t = this.simTimeSec;
    const isA = st.side === "A";
    const facing = isA ? 1 : -1;

    st.currentScale = THREE.MathUtils.damp(st.currentScale, st.targetScale, 5.2, dt);
    rig.bodyGroup.scale.setScalar(st.currentScale);

    // 1. Turntable Vinyl Platter Spin + Scratch Oscillation + Sell Power-Dip Brake
    const baseSpinRate = 3.45 * this.currentSpinBoost * (1 - st.powerDip * 0.9);
    const scratchOsc =
      st.scratchImpulse > 0.03
        ? Math.cos(t * 28.0) * st.scratchImpulse * 14.0
        : 0;
    st.platterAngle += (baseSpinRate + scratchOsc) * dt;
    rig.vinylPlatterGroup.rotation.y = st.platterAngle;

    // 2. Glowing S-Tonearm Tracking & Sell Needle-Skip Hop
    const skipHop = st.powerDip > 0.05 ? Math.abs(Math.sin(t * 24)) * st.powerDip * 0.24 : 0;
    const skipYaw = st.powerDip > 0.05 ? Math.sin(t * 32) * st.powerDip * 0.18 : 0;
    rig.tonearmGroup.rotation.x = THREE.MathUtils.damp(rig.tonearmGroup.rotation.x, -skipHop, 16, dt);
    rig.tonearmGroup.rotation.y = THREE.MathUtils.damp(
      rig.tonearmGroup.rotation.y,
      (isA ? 0.08 : -0.08) + skipYaw,
      14,
      dt,
    );
    rig.stylusGlowMaterial.color.setHex(st.powerDip > 0.25 ? 0xef4444 : 0xffffff);

    // 3. Static Glitch Overlay on Visor Perimeter during Sell
    rig.glitchOverlayMaterial.opacity =
      st.glitchTimer > 0 ? clamp(Math.abs(Math.sin(t * 38)) * 0.65, 0, 0.65) : 0;

    // 4. Console Mixer Fader Cap + Backlit Pads
    rig.faderCapMesh.position.z = 0.34 - clamp(st.surgeEnergy * 0.14 + beatHit * 0.06, 0, 0.22);
    rig.padMeshes.forEach((pad, idx) => {
      const m = pad.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(this.beatPhase + idx * 1.4) > 0.3 ? 1 : 0;
      m.emissiveIntensity = 0.55 + pulse * 0.55 + st.surgeEnergy * 0.9;
    });

    // 5. Speaker-Cone Excursion synced to BPM + Pool Spread (coneExcursion) + Trade Drops
    const excursion =
      (beatHit * this.currentConeExcursion * 0.085 + st.surgeEnergy * 0.045) *
      (1 - st.powerDip * 0.75);
    for (const cone of rig.speakerCones) {
      cone.position.z = -0.015 + excursion;
    }

    // Speaker stack vertical EQ LED bars
    const activeEqLevel = clamp(0.28 + (st.level - 1) * 0.14 + st.surgeEnergy * 0.45 + beatHit * 0.24, 0.12, 1.0);
    for (const bar of rig.speakerEqBars) {
      const thr = Number(bar.userData.eqIndex ?? 0);
      bar.visible = thr <= activeEqLevel;
    }

    // 6. Robotic DJ Body Groove, Scratch Arm & Celebration Poses
    const headBob = Math.sin(this.beatPhase) * (0.045 + this.currentCrowdGlow * 0.03);
    let torsoRoll = Math.sin(this.beatPhase * 0.5) * 0.04;
    let torsoPitch = 0.06;
    let scratchArmX = Math.sin(this.beatPhase) * 0.06;
    let scratchArmY = 0;
    let faderArmX = -Math.sin(this.beatPhase) * 0.06;
    let faderArmZ = 0;

    if (st.activeAction) {
      const elapsed = t - st.activeAction.startSec;
      const p = clamp(elapsed / st.activeAction.durationSec, 0, 1);
      if (p >= 1 && !st.activeAction.isFinale) {
        st.activeAction = null;
      } else {
        const arc = Math.sin(p * Math.PI);
        if (st.activeAction.type === "wipeoutWobble") {
          torsoPitch = -0.18 * arc;
          torsoRoll = Math.sin(p * Math.PI * 6) * 0.2 * (1 - p);
          scratchArmX = -0.35 * arc;
          faderArmX = 0.25 * arc;
        } else if (st.activeAction.type === "grandFinale") {
          const ramp = clamp(elapsed / 0.7, 0, 1);
          torsoPitch = -0.06;
          scratchArmX = -1.1 * ramp + Math.sin(t * 6) * 0.15;
          faderArmX = -1.1 * ramp - Math.sin(t * 6) * 0.15;
        } else {
          // Scratch Combo & Bass Cannon Pose
          torsoPitch = 0.16 * arc;
          scratchArmY = Math.sin(p * Math.PI * 8) * 0.24;
          scratchArmX = -0.22 * arc;
          faderArmZ = facing * Math.sin(p * Math.PI * 4) * 0.18;
        }
      }
    }

    if (st.isRunnerUp) {
      torsoPitch = -0.08;
    }

    rig.torsoGroup.position.y = 0.96 + headBob * 0.45;
    rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, torsoPitch, 10, dt);
    rig.torsoGroup.rotation.z = THREE.MathUtils.damp(rig.torsoGroup.rotation.z, torsoRoll, 10, dt);

    rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, headBob * 1.4, 12, dt);
    rig.headGroup.rotation.y = THREE.MathUtils.damp(
      rig.headGroup.rotation.y,
      st.isWinner ? facing * 0.14 : -facing * 0.08,
      6,
      dt,
    );

    rig.scratchArm.rotation.x = THREE.MathUtils.damp(rig.scratchArm.rotation.x, scratchArmX, 14, dt);
    rig.scratchArm.rotation.y = THREE.MathUtils.damp(rig.scratchArm.rotation.y, scratchArmY, 18, dt);
    rig.faderArm.rotation.x = THREE.MathUtils.damp(rig.faderArm.rotation.x, faderArmX, 14, dt);
    rig.faderArm.rotation.z = THREE.MathUtils.damp(rig.faderArm.rotation.z, faderArmZ, 12, dt);

    // 7. Smooth Level-Up Equipment Transitions (LV.2 Wing Pods, LV.3 Stack, LV.4 Line Array, LV.5 Laser Wings)
    rig.wingPodScale = THREE.MathUtils.damp(rig.wingPodScale, rig.wingPodActive ? 1 : 0.0001, 7.5, dt);
    rig.wingPodGroup.visible = rig.wingPodScale > 0.02;
    rig.wingPodGroup.scale.setScalar(rig.wingPodScale);

    rig.speakerStackHighScale = THREE.MathUtils.damp(
      rig.speakerStackHighScale,
      rig.speakerStackHighActive ? 1 : 0.0001,
      7.5,
      dt,
    );
    rig.speakerStackHighGroup.visible = rig.speakerStackHighScale > 0.02;
    rig.speakerStackHighGroup.scale.setScalar(rig.speakerStackHighScale);

    (Object.keys(rig.wearables) as WearableId[]).forEach((wid) => {
      const w = rig.wearables[wid];
      const goal = w.targetActive ? 1 : 0.0001;
      w.currentScale = THREE.MathUtils.damp(w.currentScale, goal, 7.5, dt);
      w.group.visible = w.currentScale > 0.02;
      w.group.scale.setScalar(w.currentScale);

      if (wid === "soundCrown" && w.group.visible) {
        w.group.rotation.y = t * 1.15;
        w.crownProngs?.forEach((p, idx) => {
          p.scale.y = 0.75 + Math.abs(Math.sin(this.beatPhase + idx * 0.9)) * 0.75;
        });
      }
      if (wid === "reverbCape" && w.group.visible && w.wingMeshes) {
        const half = w.wingMeshes.length / 2;
        w.wingMeshes.forEach((wing, idx) => {
          const isLeftWing = idx < half;
          const dir = isLeftWing ? -1 : 1;
          const flap = Math.sin(this.beatPhase * 0.5 + idx * 0.45) * 0.09;
          wing.rotation.y = -dir * (0.18 + flap);
        });
      }
    });

    rig.teamGlowMaterial.emissiveIntensity = clamp(
      (1.15 + clamp(st.pool / 45, 0, 1) * 0.85 + beatHit * 0.28) * (1 - st.powerDip * 0.75),
      0.22,
      2.3,
    );
  }

  private updateBackstageEqTowers(dt: number, beatHit: number): void {
    const t = this.simTimeSec;
    const poolNormA = clamp(this.djA.pool / 40, 0, 1);
    const poolNormB = clamp(this.djB.pool / 40, 0, 1);

    for (let i = 0; i < this.eqCount; i++) {
      const isLeft = i < this.eqCount / 2;
      const baseEnergy = isLeft
        ? 0.75 + poolNormA * 1.9 + this.djA.surgeEnergy * 1.65 + beatHit * 0.5
        : 0.75 + poolNormB * 1.9 + this.djB.surgeEnergy * 1.65 + beatHit * 0.5;

      const waveTarget = baseEnergy * (0.55 + 0.45 * Math.abs(Math.sin(t * 4.5 + i * 0.44)));
      this.eqLevels[i] = THREE.MathUtils.damp(this.eqLevels[i], waveTarget, 7.2, dt);

      const coord = this.eqCoords[i];
      _dummy.position.set(coord.x, coord.y, coord.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, Math.max(0.3, this.eqLevels[i]), 1);
      _dummy.updateMatrix();
      this.eqPillars.setMatrixAt(i, _dummy.matrix);

      if (this.climaxTimerSec > 0 && i % 3 === 0) {
        _color.copy(GOLD_HEX);
      } else {
        _color.copy(isLeft ? SIDE_A_HEX : SIDE_B_HEX);
      }
      this.eqPillars.setColorAt(i, _color);
    }
    this.eqPillars.instanceMatrix.needsUpdate = true;
    if (this.eqPillars.instanceColor) this.eqPillars.instanceColor.needsUpdate = true;
  }

  private updateCrowdMatrix(beatHit: number): void {
    const glow = this.currentCrowdGlow;
    for (let i = 0; i < this.crowdMembers.length; i++) {
      const m = this.crowdMembers[i];
      const jump = Math.abs(Math.sin(this.beatPhase * 0.5 + m.phase)) * (0.09 + glow * 0.18 + beatHit * 0.06);
      const sway = Math.sin(this.beatPhase * 0.5 + m.phase) * (0.14 + glow * 0.18);

      _dummy.position.set(m.x, m.y + jump * 0.55, m.z);
      _dummy.rotation.set(0, 0, sway * 0.35);
      _dummy.scale.set(1, m.baseScaleY, 1);
      _dummy.updateMatrix();
      this.crowdBodyMesh.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(m.x, m.y + jump, m.z);
      _dummy.rotation.set(0.15, 0, sway);
      _dummy.scale.set(1, 0.85 + glow * 0.3, 1);
      _dummy.updateMatrix();
      this.crowdWandMesh.setMatrixAt(i, _dummy.matrix);

      _color.copy(m.sideBias === 0 ? SIDE_A_HEX : SIDE_B_HEX);
      _color.multiplyScalar(0.32 + glow * 0.68 + beatHit * 0.22);
      this.crowdWandMesh.setColorAt(i, _color);
    }
    this.crowdBodyMesh.instanceMatrix.needsUpdate = true;
    this.crowdWandMesh.instanceMatrix.needsUpdate = true;
    if (this.crowdWandMesh.instanceColor) this.crowdWandMesh.instanceColor.needsUpdate = true;
  }

  private updateShockwaves(dt: number): void {
    for (let i = 0; i < this.shockwavePool.length; i++) {
      const sw = this.shockwavePool[i];
      const mesh = this.shockwaveMeshes[i];
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (!sw.active) {
        mesh.visible = false;
        continue;
      }
      sw.age += dt;
      const p = clamp(sw.age / sw.life, 0, 1);
      if (p >= 1) {
        sw.active = false;
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const radius = 0.55 + Math.pow(p, 0.72) * sw.maxRadius;
      mesh.position.set(sw.x, 0.24 + p * 0.45, sw.z);
      mesh.rotation.x = Math.PI * 0.44;
      mesh.scale.setScalar(radius);
      mat.color.copy(sw.color);
      mat.opacity = clamp((1 - p) * 0.58, 0, 0.65);
    }
  }

  private updatePyro(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.pyroPool.length; i++) {
      const p = this.pyroPool[i];
      if (!p.active) continue;
      anyChanged = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.pyroMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 8.4 * dt;

      const fade = 1 - p.age / p.life;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.age * 7, p.age * 5, 0);
      _dummy.scale.setScalar(p.size * fade);
      _dummy.updateMatrix();
      this.pyroMesh.setMatrixAt(i, _dummy.matrix);
      this.pyroMesh.setColorAt(i, p.color);
    }
    if (anyChanged) {
      this.pyroMesh.instanceMatrix.needsUpdate = true;
      if (this.pyroMesh.instanceColor) this.pyroMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateCoins(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.coinPool.length; i++) {
      const c = this.coinPool[i];
      if (!c.active) {
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.coinMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      anyChanged = true;
      c.elapsed += dt;
      if (c.elapsed < c.delay) {
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.coinMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const flightTime = c.elapsed - c.delay;
      const p = clamp(flightTime / c.duration, 0, 1);
      if (p >= 1) {
        c.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.coinMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const ease = 1 - Math.pow(1 - p, 2);
      const x = c.fromX + (c.toX - c.fromX) * ease;
      const yLinear = c.fromY + (c.toY - c.fromY) * ease;
      const y = yLinear + Math.sin(p * Math.PI) * c.arcHeight;
      const z = c.fromZ + (c.toZ - c.fromZ) * ease;
      const fadeOut = p > 0.85 ? (1 - p) / 0.15 : 1;

      _dummy.position.set(x, y, z);
      _dummy.rotation.set(0.25, flightTime * c.spinSpeed + c.phase, 0.12);
      _dummy.scale.setScalar(c.scale * clamp(p / 0.08, 0.2, 1) * fadeOut);
      _dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, _dummy.matrix);
      this.coinMesh.setColorAt(i, c.color);
    }
    if (anyChanged || this.climaxTimerSec > 0) {
      this.coinMesh.instanceMatrix.needsUpdate = true;
      if (this.coinMesh.instanceColor) this.coinMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateConfetti(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.confettiPool.length; i++) {
      const cf = this.confettiPool[i];
      if (!cf.active) continue;
      anyChanged = true;
      cf.age += dt;
      if (cf.age >= cf.life) {
        cf.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.confettiMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      cf.x += cf.vx * dt;
      cf.y += cf.vy * dt;
      cf.z += cf.vz * dt;
      cf.vy -= 3.6 * dt;
      cf.vx *= 0.99;
      cf.vz *= 0.99;
      cf.rx += cf.vrx * dt;
      cf.ry += cf.vry * dt;

      const fade = cf.age > cf.life * 0.7 ? (cf.life - cf.age) / (cf.life * 0.3) : 1;
      _dummy.position.set(cf.x, cf.y, cf.z);
      _dummy.rotation.set(cf.rx, cf.ry, cf.rz);
      _dummy.scale.setScalar(Math.max(0.01, fade));
      _dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, _dummy.matrix);
      this.confettiMesh.setColorAt(i, cf.color);
    }
    if (anyChanged) {
      this.confettiMesh.instanceMatrix.needsUpdate = true;
      if (this.confettiMesh.instanceColor) this.confettiMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.2);
    const shake = this.cameraTrauma * this.cameraTrauma;
    const shakeX = Math.sin(this.simTimeSec * 44) * shake * 0.14;
    const shakeY = Math.cos(this.simTimeSec * 39) * shake * 0.11;

    let aimX = Math.sin(this.simTimeSec * 0.36) * 0.15;
    let aimY = 1.56;
    const camZ = 10.6;
    const camY = 3.35;
    let desiredFov = 46;

    if (this.djA.isWinner && !this.djB.isWinner) {
      aimX = -0.38;
      aimY = 1.65;
    } else if (this.djB.isWinner && !this.djA.isWinner) {
      aimX = 0.38;
      aimY = 1.65;
    } else {
      desiredFov = 46 + (this.djA.surgeEnergy + this.djB.surgeEnergy) * 0.85;
    }

    _camTargetPos.set(aimX * 0.35 + shakeX, camY + shakeY, camZ);
    _camTargetLook.set(aimX, aimY, -1.8);

    const k = 1 - Math.exp(-5.0 * dt);
    this.currentCameraPos.lerp(_camTargetPos, k);
    this.currentCameraLook.lerp(_camTargetLook, k);

    this.targetCameraFov = THREE.MathUtils.damp(this.targetCameraFov, desiredFov, 4.5, dt);
    if (Math.abs(this.camera.fov - this.targetCameraFov) > 0.05) {
      this.camera.fov = this.targetCameraFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentCameraLook);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    clearTimeout(this.timeoutHandle);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.contextLostHandler);

    disposeDjRig(this.djA.rig);
    disposeDjRig(this.djB.rig);
    this.sceneTextures.dispose();
    this.djTextures.dispose();
    for (const item of this.disposables) {
      item.dispose();
    }
    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
