import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ARTIST_LOSE_SPLIT,
  ARTIST_WIN_SPLIT,
  type OceanWaveParams,
  PLATFORM_SPLIT,
  type Side,
  type SurferStyle,
  type TrickType,
  type WearableId,
  clamp,
  computeOceanWaveParams,
  getSurferTier,
} from "@/lib/games/battle-logic";
import { type SceneTexturePack, createSceneTexturePack } from "./proceduralTextures";
import type { ArenaEngine, ArenaTriggerPayload } from "./arenaTypes";
import {
  type SurferRig,
  buildSurferRig,
  disposeSurferRig,
  setSurferFlip,
  setSurferStyle,
  updateSurferAlbumTexture,
} from "./surferBuilder";

export type SurfTriggerPayload = ArenaTriggerPayload;

interface ActiveTrick {
  type: TrickType;
  startSec: number;
  durationSec: number;
  power01: number;
  isFinale?: boolean;
}

interface SurferRuntimeState {
  side: Side;
  rig: SurferRig;
  pool: number;
  targetScale: number;
  currentScale: number;
  surgeEnergy: number;
  waveY: number;
  activeTrick: ActiveTrick | null;
  level: number;
  baseX: number;
  baseZ: number;
  isWinner: boolean;
  isRunnerUp: boolean;
}

interface SprayParticle {
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

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();

const SIDE_A_HEX = new THREE.Color(0x7ec1fb);
const SIDE_B_HEX = new THREE.Color(0x95fe7c);
const GOLD_HEX = new THREE.Color(0xe5c25a);
const FOAM_HEX = new THREE.Color(0xd8f8ff);
const RED_SPLASH_HEX = new THREE.Color(0xef4444);

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

function evalLunarHeight(x: number, z: number): number {
  const bayCurveZ = -10.8 - Math.min(4.8, Math.abs(x) * 0.16);
  const shoreDist = bayCurveZ - z;

  if (shoreDist < -3.5) return -1.8;

  let y = shoreDist < 0
    ? -0.45 + (shoreDist + 3.5) * 0.12
    : 0.06 + Math.min(2.3, shoreDist * 0.08);

  y += Math.sin(x * 0.19 + z * 0.14) * 0.28 + Math.cos(x * 0.34 - z * 0.27) * 0.16;
  if (z < -25) {
    const mtn = (-25 - z) * 0.16;
    y += Math.abs(Math.sin(x * 0.14 + 0.8)) * mtn * 0.62;
  }

  // Deep high-contrast lunar impact craters with sharp raised rims (Image 1)
  const craters: Array<[number, number, number, number]> = [
    [-9.5, -14.2, 3.0, 0.78],
    [-2.4, -14.8, 2.7, 0.72],
    [4.6, -13.9, 3.3, 0.86],
    [11.0, -16.2, 2.8, 0.74],
    [-14.5, -19.0, 4.1, 0.92],
    [15.0, -19.6, 3.8, 0.86],
    [-5.8, -20.8, 2.5, 0.65],
    [7.5, -21.8, 3.0, 0.78],
    [0.2, -18.2, 2.2, 0.62],
  ];
  for (const [cx, cz, rad, depth] of craters) {
    const d = Math.hypot(x - cx, z - cz) / rad;
    if (d < 1.35) {
      if (d < 0.85) {
        const bowl = Math.cos((d / 0.85) * Math.PI * 0.5);
        y -= bowl * depth;
      }
      const rim = Math.exp(-Math.pow((d - 0.94) / 0.13, 2));
      y += rim * depth * 0.62;
    }
  }

  return y;
}

function createLunarTerrainGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(118, 48, 128, 54);
  geo.rotateX(-Math.PI / 2);
  // Plane centered at (0, 0, -28) spans world z in [-52 .. -4]
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i);
    const wz = pos.getZ(i) - 28;
    pos.setY(i, evalLunarHeight(wx, wz));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSpaceSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorldPos;

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
          mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = dir.y;

        // Pitch cosmic space black transitioning subtly at far horizon
        vec3 spaceBlack = vec3(0.004, 0.008, 0.018);
        vec3 horizonGlow = vec3(0.01, 0.028, 0.065);
        vec3 col = mix(horizonGlow, spaceBlack, smoothstep(-0.04, 0.18, h));

        // Faint cosmic violet-crimson-cyan nebula wisp in upper-left quadrant (Image 1)
        vec3 nebCenter = normalize(vec3(-0.46, 0.24, -0.86));
        float nebMask = pow(max(dot(dir, nebCenter), 0.0), 8.5);
        float n1 = vnoise(dir.xy * 10.5 + 1.3);
        float n2 = vnoise(dir.xy * 21.0 - 2.7);
        float wisp = smoothstep(0.3, 0.86, n1 * 0.65 + n2 * 0.35);
        vec3 nebCol = mix(vec3(0.42, 0.14, 0.44), vec3(0.14, 0.44, 0.68), n2);
        col += nebCol * nebMask * wisp * 0.72;

        // Subtle stadium atmospheric glow left cyan / right green along far rim
        float band = exp(-pow((h - 0.03) * 11.0, 2.0));
        vec3 sideScatter = mix(vec3(0.03, 0.22, 0.44), vec3(0.03, 0.3, 0.2), smoothstep(-0.4, 0.4, dir.x));
        col += sideScatter * band * 0.2;

        // Crisp multi-scale pinpoint cosmic starfield
        vec3 cellA = floor(dir * 205.0);
        float starA = fract(sin(dot(cellA, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float starMaskA = smoothstep(0.9915, 0.9993, starA) * smoothstep(0.03, 0.26, h);
        float twinkle = 0.78 + 0.22 * sin(uTime * 2.2 + starA * 90.0);
        vec3 starTint = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.92, 0.82), fract(starA * 31.7));
        col += starTint * starMaskA * twinkle * 1.35;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function createHolographicArchMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSurgeA: { value: 0 },
      uSurgeB: { value: 0 },
      uClimax: { value: 0 },
    },
    vertexShader: `
      varying vec2 vLocalXY;
      void main() {
        vLocalXY = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSurgeA;
      uniform float uSurgeB;
      uniform float uClimax;
      varying vec2 vLocalXY;

      float hash1(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      void main() {
        float r = length(vLocalXY);
        float ang = atan(vLocalXY.y, vLocalXY.x); // 0 right -> PI left
        float rNorm = clamp((r - 11.6) / 2.7, 0.0, 1.0);
        float angNorm = clamp(ang / 3.14159265, 0.0, 1.0);

        float radialEnv = smoothstep(0.0, 0.14, rNorm) * smoothstep(1.0, 0.84, rNorm);
        float innerHalo = exp(-pow((rNorm - 0.05) * 24.0, 2.0)) * 0.95;
        float outerHalo = exp(-pow((rNorm - 0.94) * 20.0, 2.0)) * 0.6;
        float rings = pow(0.5 + 0.5 * cos(rNorm * 38.0), 5.0) * 0.55;

        // Fine dotted pixelated EQ matrix sweeping along arch
        float segIdx = floor(angNorm * 116.0);
        float trackIdx = floor(rNorm * 12.0);
        float cellRand = hash1(segIdx * 13.7 + trackIdx * 41.3);
        float eqActivity = mix(uSurgeB, uSurgeA, smoothstep(0.32, 0.68, angNorm));
        float scrollPulse = 0.5 + 0.5 * sin(angNorm * 16.0 - uTime * 2.2 + trackIdx * 0.9);
        float cellMask = step(0.48 - eqActivity * 0.25, fract(cellRand + scrollPulse * 0.38));

        float gapU = smoothstep(0.08, 0.22, fract(angNorm * 116.0)) * smoothstep(0.92, 0.78, fract(angNorm * 116.0));
        float gapV = smoothstep(0.1, 0.24, fract(rNorm * 12.0)) * smoothstep(0.9, 0.76, fract(rNorm * 12.0));
        float matrix = cellMask * gapU * gapV * radialEnv;

        vec3 leftCyan = vec3(0.14, 0.74, 1.0);
        vec3 rightMint = vec3(0.14, 0.92, 0.58);
        vec3 baseTint = mix(rightMint, leftCyan, smoothstep(0.25, 0.75, angNorm));
        vec3 magentaDot = vec3(0.86, 0.32, 0.96);
        float dotPick = step(0.82, cellRand) * smoothstep(0.35, 0.85, rNorm);
        vec3 finalTint = mix(baseTint, magentaDot, dotPick * 0.7);
        finalTint = mix(finalTint, vec3(1.0, 0.88, 0.42), uClimax * 0.45);

        float alpha = clamp((innerHalo + outerHalo + rings * radialEnv * 0.35 + matrix * 0.78) * 0.72, 0.0, 0.88);
        gl_FragColor = vec4(finalTint * (0.95 + eqActivity * 0.45), alpha);
      }
    `,
  });
}

function createEarthAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        float rim = clamp(0.65 - dot(normalize(vNormalView), normalize(vViewPos)), 0.0, 1.0);
        float glow = pow(rim, 2.4) * 1.1;
        gl_FragColor = vec4(vec3(0.26, 0.66, 1.0) * glow, glow * 0.85);
      }
    `,
  });
}

function createWakeTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, w, h);
    for (const dir of [-1, 1] as const) {
      const grad = ctx.createLinearGradient(w / 2, 20, w / 2 + dir * 56, h - 10);
      grad.addColorStop(0, "rgba(255,255,255,0.92)");
      grad.addColorStop(0.55, "rgba(185,245,255,0.45)");
      grad.addColorStop(1, "rgba(140,230,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w / 2 + dir * 6, 30);
      ctx.quadraticCurveTo(w / 2 + dir * 28, h * 0.48, w / 2 + dir * 52, h - 16);
      ctx.stroke();
    }
    const midGrad = ctx.createLinearGradient(w / 2, 18, w / 2, h);
    midGrad.addColorStop(0, "rgba(255,255,255,0.75)");
    midGrad.addColorStop(0.45, "rgba(200,248,255,0.28)");
    midGrad.addColorStop(1, "rgba(180,245,255,0)");
    ctx.fillStyle = midGrad;
    ctx.fillRect(w / 2 - 14, 24, 28, h - 24);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBeamTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, "rgba(255,255,255,0.62)");
    grad.addColorStop(0.48, "rgba(220,248,255,0.22)");
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

export class SurfArenaEngine implements ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private resizeObserver: ResizeObserver;
  private texturePack: SceneTexturePack;

  private simTimeSec = 0;
  private wavePhase = 0;
  private lastPerfMs = 0;
  private timeScale = 1;
  private climaxTimerSec = 0;
  private cameraTrauma = 0;
  private frameHandle = 0;
  private timeoutHandle = 0;
  private disposed = false;

  private targetWaveParams: OceanWaveParams = computeOceanWaveParams(0, 0);
  private currentWaveAmp = 1;
  private currentWaveFreq = 1;
  private currentWaveSpeed = 1;
  private currentWaveRoughness = 0;

  private skyMaterial: THREE.ShaderMaterial;
  private archMaterial: THREE.ShaderMaterial;
  private earthMesh: THREE.Mesh;
  private oceanUniforms: {
    uTime: { value: number };
    uWavePhase: { value: number };
    uWaveAmp: { value: number };
    uWaveFreq: { value: number };
    uRoughness: { value: number };
    uSurgeA: { value: number };
    uSurgeB: { value: number };
    uPoolA: { value: number };
    uPoolB: { value: number };
    uClimax: { value: number };
    uOceanDetail: { value: THREE.Texture };
  };

  private eqPillars: THREE.InstancedMesh;
  private eqCount = 24;
  private eqLevels = new Float32Array(24);
  private eqCoords: Array<{ x: number; y: number; z: number; rotY: number }> = [];

  private waveRibbonA: THREE.Mesh;
  private waveRibbonB: THREE.Mesh;
  private wakeA: THREE.Mesh;
  private wakeB: THREE.Mesh;
  private ribbonSegments = 36;
  private ribbonHistoryA: number[] = [];
  private ribbonHistoryB: number[] = [];
  private lastSampleAt = 0;

  private sprayMesh: THREE.InstancedMesh;
  private sprayPool: SprayParticle[] = [];

  private coinMesh: THREE.InstancedMesh;
  private coinPool: VaultCoin[] = [];

  private confettiMesh: THREE.InstancedMesh;
  private confettiPool: ConfettiPiece[] = [];

  private surferA: SurferRuntimeState;
  private surferB: SurferRuntimeState;

  private climaxLight: THREE.PointLight;
  private spotlightA: THREE.PointLight;
  private spotlightB: THREE.PointLight;

  private disposables: Array<{ dispose: () => void }> = [];
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private baseCameraPos = new THREE.Vector3(0, 3.05, 9.75);
  private baseCameraLook = new THREE.Vector3(0, 1.82, -2.5);
  private currentCameraPos = new THREE.Vector3(0, 3.05, 9.75);
  private currentCameraLook = new THREE.Vector3(0, 1.82, -2.5);
  private targetCameraFov = 48;

  private contextLostHandler = (e: Event) => {
    e.preventDefault();
  };

  constructor(
    container: HTMLElement,
    initialArtA: string | HTMLCanvasElement | null,
    initialArtB: string | HTMLCanvasElement | null,
    styleA: SurferStyle = "pro",
    styleB: SurferStyle = "pro",
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
    this.renderer.toneMappingExposure = 1.06;
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

    this.texturePack = createSceneTexturePack(this.maxAnisotropy);
    this.oceanUniforms = {
      uTime: { value: 0 },
      uWavePhase: { value: 0 },
      uWaveAmp: { value: 1 },
      uWaveFreq: { value: 1 },
      uRoughness: { value: 0 },
      uSurgeA: { value: 0 },
      uSurgeB: { value: 0 },
      uPoolA: { value: 0 },
      uPoolB: { value: 0 },
      uClimax: { value: 0 },
      uOceanDetail: { value: this.texturePack.oceanDetail },
    };

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040b);
    this.scene.fog = new THREE.FogExp2(0x02060f, 0.0055);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.2, 180);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.baseCameraLook);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Moody Deep-Space Moonlight + Stadium Contrast Lighting
    const hemi = new THREE.HemisphereLight(0x4f7eb8, 0x030712, 0.48);
    this.scene.add(hemi);

    // Grazing lunar sunlight for crisp crater shadow pockets and metallic armor highlights
    const keyLight = new THREE.DirectionalLight(0xd8eaff, 1.75);
    keyLight.position.set(11, 7.2, 4.8);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    // Grazing rear rim light silhouetting shoulders & crater rims
    const lunarRimLight = new THREE.DirectionalLight(0x46b8ff, 1.25);
    lunarRimLight.position.set(-8, 6.2, -16);
    this.scene.add(lunarRimLight);

    // Team floodlights sculpted outboard/rear so dark ocean stays dramatic
    this.spotlightA = new THREE.PointLight(0x7ec1fb, 3.2, 13, 1.6);
    this.spotlightA.position.set(-4.0, 4.3, -0.4);
    this.scene.add(this.spotlightA);

    this.spotlightB = new THREE.PointLight(0x95fe7c, 3.2, 13, 1.6);
    this.spotlightB.position.set(4.0, 4.3, -0.4);
    this.scene.add(this.spotlightB);

    this.climaxLight = new THREE.PointLight(0xe5c25a, 0, 22, 1.4);
    this.climaxLight.position.set(0, 4.8, 2.2);
    this.scene.add(this.climaxLight);

    const skyGeo = this.track(new THREE.SphereGeometry(105, 32, 20));
    this.skyMaterial = this.track(createSpaceSkyMaterial());
    const skyDome = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.scene.add(skyDome);

    this.earthMesh = this.buildEarthBackdrop();
    this.archMaterial = this.buildHolographicPortal();
    this.buildLunarTerrain();
    this.eqPillars = this.buildStadiumPylonsAndEq();
    this.buildOceanSurface();

    for (let i = 0; i < this.ribbonSegments; i++) {
      this.ribbonHistoryA.push(0);
      this.ribbonHistoryB.push(0);
    }
    this.waveRibbonA = this.buildWaveRibbon(0x7ec1fb, -2.28);
    this.waveRibbonB = this.buildWaveRibbon(0x95fe7c, 2.28);

    const wakeTex = this.track(createWakeTexture());
    this.wakeA = this.buildWakeMesh(wakeTex, 0x7ec1fb, -2.18, 0.85, 0.44);
    this.wakeB = this.buildWakeMesh(wakeTex, 0x95fe7c, 2.18, 0.85, -0.44);

    // Hero-Scaled Cyber-Mecha Surfers framing the cosmic arena cleanly inside corner HUD cards
    const rigA = buildSurferRig(
      "A",
      styleA,
      initialArtA,
      this.maxAnisotropy,
      this.texturePack.neopreneBump,
      this.texturePack.armorAlbedo,
      this.texturePack.armorBump,
    );
    rigA.boardGroup.rotation.y = 0.44;
    rigA.root.position.set(-2.18, 0.36, 0.85);
    this.scene.add(rigA.root);

    const rigB = buildSurferRig(
      "B",
      styleB,
      initialArtB,
      this.maxAnisotropy,
      this.texturePack.neopreneBump,
      this.texturePack.armorAlbedo,
      this.texturePack.armorBump,
    );
    rigB.boardGroup.rotation.y = -0.44;
    rigB.root.position.set(2.18, 0.36, 0.85);
    this.scene.add(rigB.root);

    this.surferA = {
      side: "A",
      rig: rigA,
      pool: 0,
      targetScale: 1,
      currentScale: 1,
      surgeEnergy: 0,
      waveY: 0.36,
      activeTrick: null,
      level: 1,
      baseX: -2.18,
      baseZ: 0.85,
      isWinner: false,
      isRunnerUp: false,
    };

    this.surferB = {
      side: "B",
      rig: rigB,
      pool: 0,
      targetScale: 1,
      currentScale: 1,
      surgeEnergy: 0,
      waveY: 0.36,
      activeTrick: null,
      level: 1,
      baseX: 2.18,
      baseZ: 0.85,
      isWinner: false,
      isRunnerUp: false,
    };

    // 9. Micro-Spray Droplet Mist, Metallic Vault Coins & Victory Confetti
    this.sprayMesh = this.buildSprayPool();
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

  private buildEarthBackdrop(): THREE.Mesh {
    const earthGroup = new THREE.Group();
    earthGroup.position.set(-2.3, 5.2, -25.5);
    this.scene.add(earthGroup);

    const earthGeo = this.track(new THREE.SphereGeometry(1.95, 36, 24));
    const earthMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.texturePack.earthGlobeMap,
        roughness: 0.72,
        metalness: 0.04,
        emissive: 0x071a34,
        emissiveIntensity: 0.25,
      }),
    );
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.y = -0.8;
    earth.rotation.z = 0.22;
    earthGroup.add(earth);

    const atmoGeo = this.track(new THREE.SphereGeometry(2.14, 32, 20));
    const atmoMat = this.track(createEarthAtmosphereMaterial());
    const atmo = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmo);

    return earth;
  }

  private buildHolographicPortal(): THREE.ShaderMaterial {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, -0.35, -21.5);
    this.scene.add(portalGroup);

    const archMat = this.track(createHolographicArchMaterial());
    const archGeo = this.track(new THREE.RingGeometry(11.6, 14.3, 96, 6, 0, Math.PI));
    const archMesh = new THREE.Mesh(archGeo, archMat);
    portalGroup.add(archMesh);

    const rimMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x6ce5ff,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const innerRim = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(11.66, 0.055, 8, 72, Math.PI)),
      rimMat,
    );
    portalGroup.add(innerRim);

    const outerRim = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(14.2, 0.048, 8, 72, Math.PI)),
      rimMat,
    );
    portalGroup.add(outerRim);

    return archMat;
  }

  private buildLunarTerrain(): void {
    const geo = this.track(createLunarTerrainGeometry());
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x1b222d,
        roughness: 0.96,
        metalness: 0.04,
        envMapIntensity: 0.08,
        bumpMap: this.texturePack.lunarRegolithBump,
        bumpScale: 0.3,
        roughnessMap: this.texturePack.lunarRegolithBump,
      }),
    );
    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.set(0, 0, -28);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  private buildStadiumPylonsAndEq(): THREE.InstancedMesh {
    const baseMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x16202e,
        roughness: 0.48,
        metalness: 0.75,
      }),
    );

    const beamTex = this.track(createBeamTexture());

    // Iconic tall vertical stadium light pylons seated cleanly on the crater terrain (Image 1)
    const pylons: Array<{
      x: number;
      z: number;
      height: number;
      color: number;
      beamDir: number;
      hasHead?: boolean;
    }> = [
      { x: -13.2, z: -15.8, height: 6.4, color: 0x6ee7ff, beamDir: 0.28, hasHead: true },
      { x: -7.8, z: -18.5, height: 5.0, color: 0x7ec1fb, beamDir: 0.2 },
      { x: 0.4, z: -20.5, height: 4.4, color: 0x7ec1fb, beamDir: 0.0 },
      { x: 7.8, z: -18.5, height: 5.0, color: 0x95fe7c, beamDir: -0.2 },
      { x: 13.2, z: -15.8, height: 6.4, color: 0x95fe7c, beamDir: -0.28, hasHead: true },
    ];

    const baseGeo = this.track(new THREE.CylinderGeometry(0.28, 0.44, 0.6, 12));
    const ledGeo = this.track(new THREE.SphereGeometry(0.12, 8, 6));
    const coneGeo = this.track(new THREE.CylinderGeometry(0.18, 2.2, 7.6, 16, 1, true));

    for (const p of pylons) {
      const groundY = evalLunarHeight(p.x, p.z);
      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(p.x, groundY - 0.12, p.z);
      this.scene.add(pylonGroup);

      const ped = new THREE.Mesh(baseGeo, baseMat);
      ped.position.y = 0.2;
      pylonGroup.add(ped);

      const bladeMat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.96,
        }),
      );
      const blade = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.085, 0.095, p.height, 10)),
        bladeMat,
      );
      blade.position.y = p.height * 0.5 + 0.25;
      pylonGroup.add(blade);

      // Colored neon halo tube sheathing the white core blade
      const haloMat = this.track(
        new THREE.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const halo = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.21, 0.24, p.height + 0.2, 10)),
        haloMat,
      );
      halo.position.y = p.height * 0.5 + 0.25;
      pylonGroup.add(halo);

      // Optional 6-bulb LED floodlight tower head (Image 1 right)
      if (p.hasHead) {
        const headHousing = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.95, 0.52, 0.22)),
          baseMat,
        );
        headHousing.position.set(0, p.height + 0.35, 0);
        pylonGroup.add(headHousing);

        const bulbMat = this.track(new THREE.MeshBasicMaterial({ color: 0xeaf8ff }));
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            const bulb = new THREE.Mesh(ledGeo, bulbMat);
            bulb.position.set((col - 1) * 0.28, p.height + 0.24 + row * 0.22, 0.12);
            pylonGroup.add(bulb);
          }
        }
      }

      // Sweeping diagonal downward floodlight cone
      const coneMat = this.track(
        new THREE.MeshBasicMaterial({
          map: beamTex,
          color: p.color,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(p.beamDir * 3.4, p.height * 0.55, 1.4);
      cone.rotation.z = p.beamDir * 0.85;
      cone.rotation.x = 0.32;
      pylonGroup.add(cone);
    }

    // 24 sleek vertical Audio-Reactive EQ Light Blades flanking left & right craters (leaving center clear for Earth!)
    const pillarGeo = this.track(new THREE.CylinderGeometry(0.08, 0.11, 1, 10));
    pillarGeo.translate(0, 0.5, 0);
    const pillarMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x26658c,
        emissiveIntensity: 0.95,
        roughness: 0.16,
        metalness: 0.25,
        clearcoat: 0.75,
      }),
    );

    const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, this.eqCount);
    pillars.frustumCulled = false;

    const half = this.eqCount / 2;
    this.eqCoords = [];
    for (let i = 0; i < this.eqCount; i++) {
      this.eqLevels[i] = 0.6;
      const isLeft = i < half;
      const localIdx = isLeft ? i : i - half;
      const t = localIdx / (half - 1);
      const px = isLeft ? -14.8 + t * 8.6 : 6.2 + t * 8.6;
      const pz = -13.5 - Math.sin(t * Math.PI * 0.85) * 4.5;
      const py = Math.max(-0.15, evalLunarHeight(px, pz) - 0.12);
      this.eqCoords.push({ x: px, y: py, z: pz, rotY: 0 });

      _dummy.position.set(px, py, pz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1.1, 1);
      _dummy.updateMatrix();
      pillars.setMatrixAt(i, _dummy.matrix);

      _color.copy(isLeft ? SIDE_A_HEX : SIDE_B_HEX);
      pillars.setColorAt(i, _color);
    }
    pillars.instanceMatrix.needsUpdate = true;
    if (pillars.instanceColor) pillars.instanceColor.needsUpdate = true;
    this.scene.add(pillars);
    return pillars;
  }

  private buildOceanSurface(): void {
    const geo = this.track(new THREE.PlaneGeometry(116, 36, 160, 92));
    geo.rotateX(-Math.PI / 2);

    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.08,
        metalness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 0.18,
      }),
    );

    const uniforms = this.oceanUniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWavePhase = uniforms.uWavePhase;
      shader.uniforms.uWaveAmp = uniforms.uWaveAmp;
      shader.uniforms.uWaveFreq = uniforms.uWaveFreq;
      shader.uniforms.uRoughness = uniforms.uRoughness;
      shader.uniforms.uSurgeA = uniforms.uSurgeA;
      shader.uniforms.uSurgeB = uniforms.uSurgeB;
      shader.uniforms.uPoolA = uniforms.uPoolA;
      shader.uniforms.uPoolB = uniforms.uPoolB;
      shader.uniforms.uClimax = uniforms.uClimax;
      shader.uniforms.uOceanDetail = uniforms.uOceanDetail;

      shader.vertexShader =
        `
        uniform float uTime;
        uniform float uWavePhase;
        uniform float uWaveAmp;
        uniform float uWaveFreq;
        uniform float uRoughness;
        uniform float uSurgeA;
        uniform float uSurgeB;
        uniform float uPoolA;
        uniform float uPoolB;
        varying float vWaveCrest;
        varying float vWaveSpike;
        varying vec3 vOceanWorld;

        float evalOceanHeight(vec2 localXZ) {
          vec2 wxz = vec2(localXZ.x, localXZ.y - 2.5);
          float fMain = uWaveFreq;
          float fDetail = mix(1.0, uWaveFreq, 0.58);

          // Deep sweeping diagonal ocean swells dynamically scaled by pool-spread frequency & amplitude
          float swellPhase = (wxz.x * 0.34 - wxz.y * 0.56) * fMain + uWavePhase * 1.85;
          float s1 = sin(swellPhase + sin(wxz.x * 0.22 * fMain) * 0.65) * 0.24 * uWaveAmp;
          float s2 = cos((wxz.y * 0.72 + wxz.x * 0.18) * fMain - uWavePhase * 2.15) * 0.14 * uWaveAmp;
          float s3 = sin((wxz.x + wxz.y * 0.7) * (1.05 * fDetail) - uWavePhase * 2.75) * (0.075 + uRoughness * 0.11);

          // Cross-chop turbulence surging as pool spread heats up competition
          float chop = sin((wxz.x * 1.42 - wxz.y * 1.12) * fDetail + uWavePhase * 3.15)
                     * cos((wxz.x * 0.86 + wxz.y * 1.28) * fDetail - uWavePhase * 2.35)
                     * (uRoughness * 0.19);

          // Razor-sharp glowing audio-waveform EQ spikes protruding along curling wave ridges
          float ridgeMask = smoothstep(0.04, 0.42 * max(1.0, uWaveAmp * 0.75), s1 + s2);
          float eqOsc = abs(sin(wxz.x * (3.1 * fDetail) - uWavePhase * 3.8)) * (0.45 + 0.55 * abs(cos(wxz.x * (5.7 * fDetail) + uWavePhase * 2.4)));
          float eqSpikes = ridgeMask * pow(eqOsc, 1.5) * (0.42 + uRoughness * 0.34);

          // Sculpted surging wave ridges flanking & behind each surfer while carving clean rider board pockets
          float troughA = exp(-pow((wxz.x + 2.18) * 1.1, 2.0) - pow((wxz.y - 0.85) * 0.95, 2.0));
          float troughB = exp(-pow((wxz.x - 2.18) * 1.1, 2.0) - pow((wxz.y - 0.85) * 0.95, 2.0));
          float ridgeWaveA = 0.55 + 0.45 * abs(sin((wxz.x * 2.4 + wxz.y * 1.8) * fDetail - uWavePhase * 3.1));
          float ridgeWaveB = 0.55 + 0.45 * abs(sin((wxz.x * 2.4 - wxz.y * 1.8) * fDetail + uWavePhase * 3.1));
          float curlA = exp(-pow((wxz.x + 2.45) * 0.56, 2.0) - pow((wxz.y + 0.65) * 0.72, 2.0)) * ridgeWaveA * (0.16 + uPoolA * 0.24 + uSurgeA * 0.34);
          float curlB = exp(-pow((wxz.x - 2.45) * 0.56, 2.0) - pow((wxz.y + 0.65) * 0.72, 2.0)) * ridgeWaveB * (0.16 + uPoolB * 0.24 + uSurgeB * 0.34);

          float pocketCalm = clamp((troughA + troughB) * 0.65, 0.0, 0.78);
          float shoreLine = -10.5 - min(4.8, abs(wxz.x) * 0.16);
          float shoreAtten = smoothstep(shoreLine - 3.0, shoreLine + 2.4, wxz.y);
          float raw = (s1 + s2 + (s3 + chop + eqSpikes) * (1.0 - pocketCalm * 0.6) + curlA + curlB - (troughA + troughB) * (0.2 + uRoughness * 0.24));
          return raw * shoreAtten;
        }
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
        #include <beginnormal_vertex>
        float _eps = 0.16;
        float _hC = evalOceanHeight(position.xz);
        float _hX = evalOceanHeight(position.xz + vec2(_eps, 0.0));
        float _hZ = evalOceanHeight(position.xz + vec2(0.0, _eps));
        objectNormal = normalize(vec3((_hC - _hX) / _eps, 1.0, (_hC - _hZ) / _eps));
        `,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float crest = evalOceanHeight(transformed.xz);
        transformed.y += crest;
        vWaveCrest = crest;
        vec2 wxzV = vec2(transformed.x, transformed.z - 2.5);
        float fSpk = mix(1.0, uWaveFreq, 0.58);
        float waveOsc = abs(sin(wxzV.x * (2.9 * fSpk) - uWavePhase * 3.8)) * (0.45 + 0.55 * abs(cos(wxzV.x * (5.3 * fSpk) + uWavePhase * 2.4)));
        vWaveSpike = smoothstep(0.06, 0.42 * max(1.0, uWaveAmp * 0.75), crest) * pow(waveOsc, 1.3);
        vOceanWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );

      shader.fragmentShader =
        `
        uniform float uTime;
        uniform float uWavePhase;
        uniform float uWaveAmp;
        uniform float uRoughness;
        uniform float uSurgeA;
        uniform float uSurgeB;
        uniform float uClimax;
        uniform sampler2D uOceanDetail;
        varying float vWaveCrest;
        varying float vWaveSpike;
        varying vec3 vOceanWorld;
        ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        vec2 uvA = vOceanWorld.xz * 0.14 + vec2(uWavePhase * 0.036, -uWavePhase * 0.052);
        vec2 uvB = vOceanWorld.xz * 0.28 - vec2(uWavePhase * 0.044, uWavePhase * 0.038);
        vec3 detA = texture2D(uOceanDetail, uvA).rgb;
        vec3 detB = texture2D(uOceanDetail, uvB).rgb;
        float foamWeb = clamp(detA.b * 0.58 + detB.b * 0.52, 0.0, 1.0);

        float sideMaskA = smoothstep(1.8, -5.2, vOceanWorld.x);
        float sideMaskB = smoothstep(-1.8, 5.2, vOceanWorld.x);
        float crestFactor = smoothstep(0.06, 0.58 * mix(1.0, uWaveAmp, 0.48), vWaveCrest);

        // Deep abyssal midnight navy troughs vs rich translucent turquoise-emerald wave walls
        vec3 abyssCol = vec3(0.002, 0.008, 0.028);
        vec3 cyanWater = vec3(0.01, 0.18, 0.34);
        vec3 emeraldWater = vec3(0.01, 0.24, 0.22);
        vec3 sssWater = mix(vec3(0.01, 0.2, 0.3), cyanWater * sideMaskA + emeraldWater * sideMaskB, 0.78);
        vec3 waterBase = mix(abyssCol, sssWater, crestFactor);

        // Crisp electric cyan-tinted foam lace strictly along sharpest crest tips & shoreline
        float shoreLine = -10.6 - min(4.8, abs(vOceanWorld.x) * 0.16);
        float shoreFoam = exp(-pow((vOceanWorld.z - shoreLine) * 1.15, 2.0)) * (0.28 + foamWeb * 0.58);
        float crestFoam = smoothstep(0.54 - uRoughness * 0.14, 0.94 - uRoughness * 0.12, vWaveCrest * 1.15 + foamWeb * (0.34 + uRoughness * 0.18) - 0.12);
        float totalFoam = clamp(crestFoam * (0.45 + uRoughness * 0.22) + shoreFoam * 0.55, 0.0, 1.0);

        vec3 foamTint = mix(vec3(0.14, 0.78, 0.92), vec3(0.88, 0.84, 0.54), uClimax * 0.4);
        diffuseColor.rgb = mix(waterBase, foamTint, clamp(totalFoam * (0.24 + uRoughness * 0.16), 0.0, 0.42));
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        vec2 rUv1 = vOceanWorld.xz * 0.16 + vec2(uWavePhase * 0.04, -uWavePhase * 0.055);
        vec2 rUv2 = vOceanWorld.xz * 0.36 + vec2(-uWavePhase * 0.048, uWavePhase * 0.032);
        vec2 rip1 = texture2D(uOceanDetail, rUv1).rg - 0.5;
        vec2 rip2 = texture2D(uOceanDetail, rUv2).rg - 0.5;
        vec2 ripGrad = rip1 * 0.44 + rip2 * 0.3;
        vec3 rippleView = (viewMatrix * vec4(ripGrad.x, 0.0, ripGrad.y, 0.0)).xyz;
        normal = normalize(normal + rippleView * (0.82 + uRoughness * 0.42));
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clearcoat_normal_fragment_begin>",
        `
        #include <clearcoat_normal_fragment_begin>
        #ifdef USE_CLEARCOAT
        vec2 ccUv1 = vOceanWorld.xz * 0.2 + vec2(uWavePhase * 0.042, -uWavePhase * 0.058);
        vec2 ccGrad = (texture2D(uOceanDetail, ccUv1).rg - 0.5) * (0.4 + uRoughness * 0.22);
        vec3 ccRipple = (viewMatrix * vec4(ccGrad.x, 0.0, ccGrad.y, 0.0)).xyz;
        clearcoatNormal = normalize(clearcoatNormal + ccRipple);
        #endif
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `
        #include <emissivemap_fragment>
        // Saturated electric turquoise/emerald translucent crest glow (troughs stay midnight-dark!)
        float sA = smoothstep(2.0, -5.2, vOceanWorld.x);
        float sB = smoothstep(-2.0, 5.2, vOceanWorld.x);
        vec3 sideGlowCol = mix(vec3(0.0, 0.56, 0.9), vec3(0.0, 0.66, 1.0) * sA + vec3(0.02, 0.86, 0.5) * sB, 0.84);
        float ridgeGlow = pow(smoothstep(0.1, 0.6 * max(1.0, uWaveAmp * 0.72), vWaveCrest), 2.1) * (0.28 + uRoughness * 0.14);
        float sharpSpikeGlow = pow(clamp(vWaveCrest * 1.45, 0.0, 1.0), 2.2) * vWaveSpike * (0.84 + uRoughness * 0.2);
        float surgeBoost = 1.0 + uSurgeA * sA * 0.55 + uSurgeB * sB * 0.55 + uRoughness * 0.18;
        totalEmissiveRadiance += sideGlowCol * (ridgeGlow + sharpSpikeGlow) * surgeBoost;
        `,
      );
    };

    const ocean = new THREE.Mesh(geo, mat);
    ocean.position.set(0, -0.18, -2.5);
    ocean.receiveShadow = true;
    this.scene.add(ocean);
  }

  private buildWakeMesh(
    wakeTex: THREE.Texture,
    colorHex: number,
    x: number,
    z: number,
    yaw: number,
  ): THREE.Mesh {
    const geo = this.track(new THREE.PlaneGeometry(1.3, 3.2));
    geo.rotateX(-Math.PI / 2);
    const mat = this.track(
      new THREE.MeshBasicMaterial({
        map: wakeTex,
        color: colorHex,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.04, z - 1.35);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);
    return mesh;
  }

  private buildWaveRibbon(colorHex: number, centerX: number): THREE.Mesh {
    const segs = this.ribbonSegments;
    const positions = new Float32Array(segs * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i < segs - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);

    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.9,
        roughness: 0.16,
        metalness: 0.2,
        clearcoat: 0.9,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
      }),
    );

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(centerX, 0.02, 0.85);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private updateWaveRibbon(mesh: THREE.Mesh, history: number[], dirSign: 1 | -1): void {
    const posAttr = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const maxVal = Math.max(10, ...this.ribbonHistoryA, ...this.ribbonHistoryB);
    const n = this.ribbonSegments;
    const span = 5.2;

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const zOffset = -4.6 * (1 - t) - 0.55;
      const xWiggle = Math.sin(this.simTimeSec * 2.5 + t * 5.0) * 0.2 * dirSign;
      const val = history[i] ?? 0;
      const h = 0.08 + clamp(val / maxVal, 0, 1) * 1.35;

      const idxTop = i * 2;
      const idxBot = i * 2 + 1;
      posAttr.setXYZ(idxTop, xWiggle - (1 - t) * 0.85 * dirSign, h, zOffset);
      posAttr.setXYZ(idxBot, xWiggle - (1 - t) * 0.85 * dirSign, -0.08, zOffset + span * 0.01);
    }
    posAttr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  private buildSprayPool(): THREE.InstancedMesh {
    const count = 220;
    const geo = this.track(new THREE.IcosahedronGeometry(0.032, 0));
    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xe6fbff,
        emissive: 0x7ec1fb,
        emissiveIntensity: 0.55,
        roughness: 0.14,
        metalness: 0.05,
        clearcoat: 0.85,
        transparent: true,
        opacity: 0.78,
      }),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.sprayPool.push({
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
        color: new THREE.Color(0xffffff),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, FOAM_HEX);
    }
    this.scene.add(mesh);
    return mesh;
  }

  private buildCoinPool(): THREE.InstancedMesh {
    const count = 150;
    const geo = this.track(createVaultCoinGeometry());
    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x162238,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0.82,
        clearcoat: 0.75,
        clearcoatRoughness: 0.14,
        envMapIntensity: 1.3,
      }),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.coinPool.push({
        active: false,
        delay: 0,
        elapsed: 0,
        duration: 1,
        fromX: 0,
        fromY: 0,
        fromZ: 0,
        toX: 0,
        toY: 0,
        toZ: 0,
        arcHeight: 2,
        spinSpeed: 8,
        phase: 0,
        scale: 1,
        color: new THREE.Color(0xe5c25a),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, GOLD_HEX);
    }
    this.scene.add(mesh);
    return mesh;
  }

  private buildConfettiPool(): THREE.InstancedMesh {
    const count = 120;
    const geo = this.track(new THREE.BoxGeometry(0.24, 0.036, 0.16));
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x333333,
        emissiveIntensity: 0.45,
        roughness: 0.26,
        metalness: 0.45,
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
      mesh.setColorAt(i, GOLD_HEX);
    }
    this.scene.add(mesh);
    return mesh;
  }

  private spawnSpray(
    x: number,
    y: number,
    z: number,
    count: number,
    color: THREE.Color,
    speed: number,
    upBias: number,
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.sprayPool.length && spawned < count; i++) {
      const p = this.sprayPool[i];
      if (!p.active) {
        p.active = true;
        const ang = Math.random() * Math.PI * 2;
        const spd = speed * (0.45 + Math.random() * 0.75);
        p.x = x + (Math.random() - 0.5) * 0.72;
        p.y = y + Math.random() * 0.28;
        p.z = z + (Math.random() - 0.5) * 0.72;
        p.vx = Math.cos(ang) * spd;
        p.vy = upBias + Math.random() * spd * 1.1;
        p.vz = Math.sin(ang) * spd;
        p.age = 0;
        p.life = 0.45 + Math.random() * 0.45;
        p.size = 0.55 + Math.random() * 0.9;
        p.color.copy(Math.random() > 0.35 ? color : FOAM_HEX);
        spawned++;
      }
    }
  }

  public syncSurferPools(poolA: number, poolB: number): void {
    this.applyPoolToSurfer(this.surferA, poolA);
    this.applyPoolToSurfer(this.surferB, poolB);
    this.oceanUniforms.uPoolA.value = clamp(poolA / 65, 0, 1);
    this.oceanUniforms.uPoolB.value = clamp(poolB / 65, 0, 1);
    this.targetWaveParams = computeOceanWaveParams(poolA, poolB);
  }

  public getOceanWaveState() {
    return {
      poolDiff: this.targetWaveParams.poolDiff,
      roughness01: this.currentWaveRoughness,
      amplitudeMultiplier: this.currentWaveAmp,
      frequencyMultiplier: this.currentWaveFreq,
      speedMultiplier: this.currentWaveSpeed,
      wavePhase: this.wavePhase,
    };
  }

  private applyPoolToSurfer(state: SurferRuntimeState, pool: number): void {
    state.pool = Math.max(0, pool);
    const tier = getSurferTier(state.pool);
    state.level = tier.level;
    state.targetScale = tier.scale;
    const activeSet = new Set<WearableId>(tier.wearables);
    (Object.keys(state.rig.wearables) as WearableId[]).forEach((wid) => {
      state.rig.wearables[wid].targetActive = activeSet.has(wid);
    });
  }

  public triggerTrick(payload: SurfTriggerPayload): void {
    const state = payload.side === "A" ? this.surferA : this.surferB;
    state.activeTrick = {
      type: payload.trick,
      startSec: this.simTimeSec,
      durationSec: payload.durationMs / 1000,
      power01: payload.power01,
      isFinale: payload.trick === "grandFinale",
    };

    const isSell = payload.trick === "wipeoutWobble";
    if (isSell) {
      state.surgeEnergy = Math.max(0, state.surgeEnergy - 0.35);
      this.spawnSpray(state.baseX, state.waveY + 0.15, state.baseZ, 24, RED_SPLASH_HEX, 3.2, 2.2);
    } else {
      state.surgeEnergy = clamp(state.surgeEnergy + 0.4 + payload.power01 * 0.75, 0, 1.5);
      this.cameraTrauma = clamp(this.cameraTrauma + payload.power01 * 0.42, 0, 0.85);
      const sideCol = payload.side === "A" ? SIDE_A_HEX : SIDE_B_HEX;
      this.spawnSpray(
        state.baseX,
        state.waveY + 0.25,
        state.baseZ,
        Math.round(18 + payload.power01 * 32),
        payload.power01 > 0.7 ? GOLD_HEX : sideCol,
        3.5 + payload.power01 * 3.5,
        2.5 + payload.power01 * 2.8,
      );

      const mid = payload.side === "A" ? 6 : 18;
      for (let i = -4; i <= 4; i++) {
        const idx = clamp(mid + i, 0, this.eqCount - 1);
        this.eqLevels[idx] = clamp(
          this.eqLevels[idx] + (1 - Math.abs(i) * 0.18) * (1.2 + payload.power01 * 2.6),
          0.5,
          5.2,
        );
      }
    }
  }

  public triggerGrandFinale(winnerSide: Side | "tie"): void {
    this.climaxTimerSec = 4.2;
    this.cameraTrauma = 0.75;

    if (winnerSide === "tie") {
      this.surferA.isWinner = false;
      this.surferB.isWinner = false;
      this.surferA.isRunnerUp = false;
      this.surferB.isRunnerUp = false;
      this.triggerTrick({
        side: "A",
        trick: "spin360",
        power01: 0.9,
        waveSurge: 1.5,
        durationMs: 2200,
      });
      this.triggerTrick({
        side: "B",
        trick: "spin360",
        power01: 0.9,
        waveSurge: 1.5,
        durationMs: 2200,
      });
      this.spawnConfetti(0, 3.8, 0.2);
      return;
    }

    const winState = winnerSide === "A" ? this.surferA : this.surferB;
    const loseState = winnerSide === "A" ? this.surferB : this.surferA;
    winState.isWinner = true;
    winState.isRunnerUp = false;
    loseState.isWinner = false;
    loseState.isRunnerUp = true;
    winState.surgeEnergy = 1.45;
    winState.activeTrick = {
      type: "grandFinale",
      startSec: this.simTimeSec,
      durationSec: 6.5,
      power01: 1,
      isFinale: true,
    };

    this.timeScale = 0.45;

    const winCol = winnerSide === "A" ? SIDE_A_HEX : SIDE_B_HEX;
    this.spawnSpray(winState.baseX, 0.8, winState.baseZ, 48, GOLD_HEX, 5.5, 4.6);
    this.spawnSpray(winState.baseX, 0.8, winState.baseZ, 28, winCol, 4.8, 3.8);
    this.spawnConfetti(winState.baseX * 0.55, 4.2, 0.2);
  }

  public triggerCoinSplit(winnerSide: Side): void {
    const weightTotal = ARTIST_WIN_SPLIT + ARTIST_LOSE_SPLIT + PLATFORM_SPLIT; // 0.10
    const coinTotal = 140;

    const winCount = Math.round(coinTotal * (ARTIST_WIN_SPLIT / weightTotal)); // 70 coins (5%)
    const loseCount = Math.round(coinTotal * (ARTIST_LOSE_SPLIT / weightTotal)); // 28 coins (2%)
    const platCount = Math.max(1, coinTotal - winCount - loseCount); // 42 coins (3%)

    const winTarget =
      winnerSide === "A" ? { x: -3.55, y: 2.35, z: 0.6 } : { x: 3.55, y: 2.35, z: 0.6 };
    const loseTarget =
      winnerSide === "A" ? { x: 3.55, y: 2.35, z: 0.6 } : { x: -3.55, y: 2.35, z: 0.6 };
    const platTarget = { x: 0, y: 3.35, z: -0.4 };

    const winColor = winnerSide === "A" ? SIDE_A_HEX : SIDE_B_HEX;
    const loseColor = winnerSide === "A" ? SIDE_B_HEX : SIDE_A_HEX;

    const groups = [
      { target: winTarget, color: winColor, count: winCount, scale: 1.12 },
      { target: loseTarget, color: loseColor, count: loseCount, scale: 0.9 },
      { target: platTarget, color: GOLD_HEX, count: platCount, scale: 1.0 },
    ];

    let idx = 0;
    for (const grp of groups) {
      for (let i = 0; i < grp.count && idx < this.coinPool.length; i++) {
        const c = this.coinPool[idx++];
        c.active = true;
        c.delay = Math.random() * 0.72 + i * 0.006;
        c.elapsed = 0;
        c.duration = 0.85 + Math.random() * 0.45;
        c.fromX = (Math.random() - 0.5) * 0.6;
        c.fromY = 1.2 + (Math.random() - 0.5) * 0.3;
        c.fromZ = (Math.random() - 0.5) * 0.4;
        c.toX = grp.target.x + (Math.random() - 0.5) * 0.65;
        c.toY = grp.target.y + (Math.random() - 0.5) * 0.45;
        c.toZ = grp.target.z + (Math.random() - 0.5) * 0.3;
        c.arcHeight = 1.25 + Math.random() * 1.45;
        c.spinSpeed = 9 + Math.random() * 8;
        c.phase = Math.random() * Math.PI * 2;
        c.scale = grp.scale * (0.88 + Math.random() * 0.28);
        c.color.copy(grp.color);
      }
    }

    this.spawnSpray(0, 1.1, 0, 28, GOLD_HEX, 5.2, 3.6);
  }

  private spawnConfetti(cx: number, cy: number, cz: number): void {
    const palette = [SIDE_A_HEX, SIDE_B_HEX, GOLD_HEX, FOAM_HEX];
    for (let i = 0; i < this.confettiPool.length; i++) {
      const c = this.confettiPool[i];
      c.active = true;
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 5.0;
      c.x = cx + (Math.random() - 0.5) * 1.4;
      c.y = cy + (Math.random() - 0.5) * 0.5;
      c.z = cz + (Math.random() - 0.5) * 1.0;
      c.vx = Math.cos(ang) * spd;
      c.vy = 2.2 + Math.random() * 4.5;
      c.vz = Math.sin(ang) * spd * 0.6;
      c.rx = Math.random() * Math.PI;
      c.ry = Math.random() * Math.PI;
      c.rz = Math.random() * Math.PI;
      c.vrx = (Math.random() - 0.5) * 11;
      c.vry = (Math.random() - 0.5) * 11;
      c.age = 0;
      c.life = 2.6 + Math.random() * 1.5;
      c.color.copy(palette[i % palette.length]);
    }
  }

  public setSurferPhoto(side: Side, dataUrl: string): void {
    const st = side === "A" ? this.surferA : this.surferB;
    updateSurferAlbumTexture(st.rig, dataUrl, st.rig.flipX, this.maxAnisotropy);
  }

  public setSurferFlip(side: Side, flipX: boolean): void {
    const st = side === "A" ? this.surferA : this.surferB;
    setSurferFlip(st.rig, flipX);
  }

  public setSurferStyle(side: Side, style: SurferStyle): void {
    const st = side === "A" ? this.surferA : this.surferB;
    setSurferStyle(st.rig, style);
  }

  public reset(): void {
    this.timeScale = 1;
    this.climaxTimerSec = 0;
    this.cameraTrauma = 0;
    this.targetCameraFov = 45;
    this.oceanUniforms.uClimax.value = 0;

    [this.surferA, this.surferB].forEach((st) => {
      st.activeTrick = null;
      st.surgeEnergy = 0;
      st.isWinner = false;
      st.isRunnerUp = false;
    });
    this.syncSurferPools(0, 0);

    for (let i = 0; i < this.ribbonSegments; i++) {
      this.ribbonHistoryA[i] = 0;
      this.ribbonHistoryB[i] = 0;
    }

    for (const c of this.coinPool) c.active = false;
    for (const cf of this.confettiPool) cf.active = false;
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

  private stepSimulation(rawDt: number): void {
    this.timeScale = THREE.MathUtils.damp(this.timeScale, 1.0, 2.2, rawDt);
    const dt = rawDt * this.timeScale;
    this.simTimeSec += dt;

    if (this.climaxTimerSec > 0) {
      this.climaxTimerSec = Math.max(0, this.climaxTimerSec - rawDt);
      this.oceanUniforms.uClimax.value = clamp(this.climaxTimerSec / 2.2, 0, 1);
      this.climaxLight.intensity = clamp(this.climaxTimerSec * 3.5, 0, 10);
    } else {
      this.oceanUniforms.uClimax.value = THREE.MathUtils.damp(
        this.oceanUniforms.uClimax.value,
        0,
        4,
        rawDt,
      );
      this.climaxLight.intensity = THREE.MathUtils.damp(this.climaxLight.intensity, 0, 4, rawDt);
    }

    this.skyMaterial.uniforms.uTime.value = this.simTimeSec;
    this.archMaterial.uniforms.uTime.value = this.simTimeSec;
    this.archMaterial.uniforms.uSurgeA.value = this.surferA.surgeEnergy;
    this.archMaterial.uniforms.uSurgeB.value = this.surferB.surgeEnergy;
    this.archMaterial.uniforms.uClimax.value = this.oceanUniforms.uClimax.value;
    this.earthMesh.rotation.y += rawDt * 0.04;

    this.currentWaveAmp = THREE.MathUtils.damp(
      this.currentWaveAmp,
      this.targetWaveParams.amplitudeMultiplier,
      2.8,
      rawDt,
    );
    this.currentWaveFreq = THREE.MathUtils.damp(
      this.currentWaveFreq,
      this.targetWaveParams.frequencyMultiplier,
      2.8,
      rawDt,
    );
    this.currentWaveSpeed = THREE.MathUtils.damp(
      this.currentWaveSpeed,
      this.targetWaveParams.speedMultiplier,
      2.8,
      rawDt,
    );
    this.currentWaveRoughness = THREE.MathUtils.damp(
      this.currentWaveRoughness,
      this.targetWaveParams.roughness01,
      2.8,
      rawDt,
    );
    this.wavePhase += dt * this.currentWaveSpeed;

    this.oceanUniforms.uTime.value = this.simTimeSec;
    this.oceanUniforms.uWavePhase.value = this.wavePhase;
    this.oceanUniforms.uWaveAmp.value = this.currentWaveAmp;
    this.oceanUniforms.uWaveFreq.value = this.currentWaveFreq;
    this.oceanUniforms.uRoughness.value = this.currentWaveRoughness;
    this.surferA.surgeEnergy = THREE.MathUtils.damp(this.surferA.surgeEnergy, 0, 2.1, dt);
    this.surferB.surgeEnergy = THREE.MathUtils.damp(this.surferB.surgeEnergy, 0, 2.1, dt);
    this.oceanUniforms.uSurgeA.value = this.surferA.surgeEnergy;
    this.oceanUniforms.uSurgeB.value = this.surferB.surgeEnergy;

    if (this.simTimeSec - this.lastSampleAt > 0.14) {
      this.lastSampleAt = this.simTimeSec;
      this.ribbonHistoryA.shift();
      this.ribbonHistoryA.push(this.surferA.pool + this.surferA.surgeEnergy * 4);
      this.ribbonHistoryB.shift();
      this.ribbonHistoryB.push(this.surferB.pool + this.surferB.surgeEnergy * 4);
    }
    this.updateWaveRibbon(this.waveRibbonA, this.ribbonHistoryA, 1);
    this.updateWaveRibbon(this.waveRibbonB, this.ribbonHistoryB, -1);

    this.updateSurferKinematics(this.surferA, this.wakeA, dt);
    this.updateSurferKinematics(this.surferB, this.wakeB, dt);

    // Ambient crest sea spray droplets bursting continuously from illuminated wave lips
    if (Math.random() < 0.55 + this.currentWaveRoughness * 0.35) {
      this.spawnSpray(
        this.surferA.baseX - 0.55 + (Math.random() - 0.5) * 2.2,
        this.surferA.waveY,
        this.surferA.baseZ - 0.4 + (Math.random() - 0.5) * 1.4,
        2,
        SIDE_A_HEX,
        1.7 + this.currentWaveRoughness * 1.2,
        1.1 + this.currentWaveRoughness * 0.7,
      );
      this.spawnSpray(
        this.surferB.baseX + 0.55 + (Math.random() - 0.5) * 2.2,
        this.surferB.waveY,
        this.surferB.baseZ - 0.4 + (Math.random() - 0.5) * 1.4,
        2,
        SIDE_B_HEX,
        1.7 + this.currentWaveRoughness * 1.2,
        1.1 + this.currentWaveRoughness * 0.7,
      );
    }

    this.updateEqPillars(dt);
    this.updateSpray(rawDt);
    this.updateCoins(rawDt);
    this.updateConfetti(rawDt);
    this.updateCamera(rawDt);
  }

  private updateSurferKinematics(
    st: SurferRuntimeState,
    wakeMesh: THREE.Mesh,
    dt: number,
  ): void {
    const rig = st.rig;
    const t = this.simTimeSec;
    const wp = this.wavePhase;
    const isA = st.side === "A";
    const facing = isA ? 1 : -1;

    st.currentScale = THREE.MathUtils.damp(st.currentScale, st.targetScale, 5.2, dt);
    rig.root.scale.setScalar(st.currentScale);

    const poolLift = clamp(st.pool / 65, 0, 1) * 0.24;
    const roughLift = this.currentWaveRoughness * 0.24;
    const phaseOff = isA ? 0 : 1.7;
    const swellWave =
      (Math.sin(wp * 2.1 + phaseOff) * 0.13 +
        Math.cos(wp * 1.45 + phaseOff * 0.6) * 0.06) *
        this.currentWaveAmp +
      st.surgeEnergy * 0.26 +
      poolLift +
      roughLift;

    const roughMotion = 1 + this.currentWaveRoughness * 0.75;
    let offsetY = 0;
    let offsetX = 0;
    let boardRoll = Math.sin(wp * 2.1 + (isA ? 0 : 1.5)) * 0.09 * roughMotion;
    let boardPitch = Math.cos(wp * 1.65 + (isA ? 0.5 : 2.0)) * 0.08 * roughMotion;
    let bodySpinY = 0;
    let torsoTilt = 0.08;
    let kneeFlex = 0.12;
    let leftArmZ = 0.05;
    let rightArmZ = -0.05;
    let leftArmX = 0;
    let rightArmX = 0;
    let winnerBounce = 0;

    if (st.activeTrick) {
      const elapsed = t - st.activeTrick.startSec;
      const p = clamp(elapsed / st.activeTrick.durationSec, 0, 1);

      if (p >= 1 && !st.activeTrick.isFinale) {
        st.activeTrick = null;
      } else {
        const arc = Math.sin(p * Math.PI);
        switch (st.activeTrick.type) {
          case "carve":
            boardRoll += facing * Math.sin(p * Math.PI * 2) * 0.42;
            boardPitch += Math.sin(p * Math.PI) * 0.25;
            offsetX += facing * Math.sin(p * Math.PI * 2) * 0.42;
            offsetY += arc * 0.26;
            kneeFlex = 0.26;
            leftArmZ = 0.28;
            rightArmZ = -0.28;
            break;

          case "indyGrab":
            offsetY += arc * (0.72 + st.activeTrick.power01 * 0.42);
            boardPitch += arc * 0.42;
            boardRoll += facing * arc * 0.34;
            kneeFlex = 0.42 * arc;
            if (isA) {
              rightArmX = -0.55 * arc;
              rightArmZ = 0.36 * arc;
              leftArmZ = -0.35 * arc;
            } else {
              leftArmX = -0.55 * arc;
              leftArmZ = -0.36 * arc;
              rightArmZ = 0.35 * arc;
            }
            break;

          case "spin360":
            offsetY += arc * (0.9 + st.activeTrick.power01 * 0.46);
            bodySpinY = facing * p * Math.PI * 2;
            boardPitch += Math.sin(p * Math.PI * 2) * 0.32;
            boardRoll += facing * arc * 0.42;
            leftArmZ = -0.45 * arc;
            rightArmZ = 0.45 * arc;
            break;

          case "megaTsunami":
            offsetY += arc * 1.2;
            bodySpinY = facing * p * Math.PI * 4;
            boardPitch += Math.sin(p * Math.PI * 3) * 0.38;
            boardRoll += facing * Math.sin(p * Math.PI * 2) * 0.58;
            leftArmZ = -0.62 * arc;
            rightArmZ = 0.62 * arc;
            break;

          case "wipeoutWobble":
            offsetY -= arc * 0.26;
            boardRoll += Math.sin(p * Math.PI * 5) * 0.52 * (1 - p);
            boardPitch -= arc * 0.28;
            torsoTilt = -0.24 * arc;
            leftArmZ = Math.sin(p * Math.PI * 6) * 0.65;
            rightArmZ = Math.sin(p * Math.PI * 6 + Math.PI) * 0.65;
            break;

          case "grandFinale": {
            const ramp = clamp(elapsed / 0.85, 0, 1);
            const settle = 1 - Math.pow(1 - ramp, 3);
            offsetY += settle * 0.64 + Math.sin(t * 2.4) * 0.1;
            offsetX += -facing * settle * 0.55;
            boardPitch = 0.2 * settle;
            boardRoll = facing * -0.14 * settle;
            winnerBounce = Math.abs(Math.sin(t * 4.2)) * 0.06;
            if (isA) {
              rightArmZ = 1.25 * settle;
              leftArmZ = 0.18 * settle;
            } else {
              leftArmZ = -1.25 * settle;
              rightArmZ = -0.18 * settle;
            }
            break;
          }
        }
      }
    }

    if (st.isRunnerUp) {
      offsetY -= 0.12;
      offsetX += facing * 0.36;
      torsoTilt = -0.05;
    }

    st.waveY = 0.36 + swellWave + offsetY + winnerBounce;
    rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, st.baseX + offsetX, 7.5, dt);
    rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, st.waveY, 10.5, dt);
    rig.root.position.z = st.baseZ;

    wakeMesh.position.x = rig.root.position.x - facing * 0.38;
    wakeMesh.position.y = Math.max(-0.08, -0.02 + swellWave * 0.65);
    const wakeMat = wakeMesh.material as THREE.MeshBasicMaterial;
    wakeMat.opacity = clamp(0.24 - offsetY * 0.12 + st.surgeEnergy * 0.18, 0.05, 0.42);
    wakeMesh.scale.setScalar(st.currentScale * (0.95 + st.surgeEnergy * 0.3));

    rig.contactShadow.position.y = Math.max(-2.6, -offsetY + 0.02);
    const contactMat = rig.contactShadow.material as THREE.MeshBasicMaterial;
    contactMat.opacity = clamp(0.24 - offsetY * 0.08, 0.06, 0.3);

    rig.boardGroup.rotation.z = THREE.MathUtils.damp(rig.boardGroup.rotation.z, boardRoll, 10, dt);
    rig.boardGroup.rotation.x = THREE.MathUtils.damp(rig.boardGroup.rotation.x, boardPitch, 10, dt);
    rig.boardGroup.rotation.y = THREE.MathUtils.damp(
      rig.boardGroup.rotation.y,
      facing * 0.44 + bodySpinY,
      11,
      dt,
    );

    rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, torsoTilt, 9, dt);
    rig.leftLegGroup.rotation.x = THREE.MathUtils.damp(rig.leftLegGroup.rotation.x, -kneeFlex, 10, dt);
    rig.rightLegGroup.rotation.x = THREE.MathUtils.damp(rig.rightLegGroup.rotation.x, -kneeFlex, 10, dt);

    rig.leftArmGroup.rotation.z = THREE.MathUtils.damp(
      rig.leftArmGroup.rotation.z,
      leftArmZ + Math.sin(t * 2.2) * 0.08,
      10,
      dt,
    );
    rig.rightArmGroup.rotation.z = THREE.MathUtils.damp(
      rig.rightArmGroup.rotation.z,
      rightArmZ - Math.sin(t * 2.2) * 0.08,
      10,
      dt,
    );
    rig.leftArmGroup.rotation.x = THREE.MathUtils.damp(rig.leftArmGroup.rotation.x, leftArmX, 10, dt);
    rig.rightArmGroup.rotation.x = THREE.MathUtils.damp(rig.rightArmGroup.rotation.x, rightArmX, 10, dt);

    rig.headGroup.rotation.x = Math.sin(t * 2.3 + (isA ? 0 : 1)) * 0.05;
    rig.headGroup.rotation.y = THREE.MathUtils.damp(
      rig.headGroup.rotation.y,
      st.isWinner ? facing * 0.15 : -facing * 0.1,
      6,
      dt,
    );

    (Object.keys(rig.wearables) as WearableId[]).forEach((wid) => {
      const w = rig.wearables[wid];
      const goal = w.targetActive ? 1 : 0.0001;
      w.currentScale = THREE.MathUtils.damp(w.currentScale, goal, 7.5, dt);
      w.group.visible = w.currentScale > 0.02;
      w.group.scale.setScalar(w.currentScale);

      if (wid === "soundCrown" && w.group.visible) {
        w.group.rotation.y = t * 1.1;
        w.crownProngs?.forEach((p, idx) => {
          p.scale.y = 0.75 + Math.abs(Math.sin(t * 5.2 + idx * 0.9)) * 0.75;
        });
      }
      if (wid === "reverbCape" && w.group.visible && w.wingMeshes) {
        const half = w.wingMeshes.length / 2;
        w.wingMeshes.forEach((wing, idx) => {
          const isLeftWing = idx < half;
          const dir = isLeftWing ? -1 : 1;
          const flap = Math.sin(t * 4.5 + idx * 0.45) * 0.08;
          wing.rotation.y = -dir * (0.18 + flap);
        });
      }
    });

    rig.teamGlowMaterial.emissiveIntensity =
      1.2 + clamp(st.pool / 45, 0, 1) * 0.85 + Math.sin(t * 3.5) * 0.14;
  }

  private updateEqPillars(dt: number): void {
    const t = this.simTimeSec;
    const poolNormA = clamp(this.surferA.pool / 40, 0, 1);
    const poolNormB = clamp(this.surferB.pool / 40, 0, 1);

    for (let i = 0; i < this.eqCount; i++) {
      const isLeft = i < this.eqCount / 2;
      const baseEnergy = isLeft
        ? 0.65 + poolNormA * 1.85 + this.surferA.surgeEnergy * 1.5
        : 0.65 + poolNormB * 1.85 + this.surferB.surgeEnergy * 1.5;

      const waveTarget = baseEnergy * (0.55 + 0.45 * Math.abs(Math.sin(t * 4.8 + i * 0.42)));
      this.eqLevels[i] = THREE.MathUtils.damp(this.eqLevels[i], waveTarget, 6.5, dt);

      const coord = this.eqCoords[i];
      _dummy.position.set(coord.x, coord.y, coord.z);
      _dummy.rotation.set(0, coord.rotY, 0);
      _dummy.scale.set(1, Math.max(0.25, this.eqLevels[i]), 1);
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

  private updateSpray(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.sprayPool.length; i++) {
      const p = this.sprayPool[i];
      if (!p.active) continue;
      anyChanged = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.sprayMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.5 * dt;

      const fade = 1 - p.age / p.life;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.age * 5, p.age * 3, 0);
      _dummy.scale.setScalar(p.size * fade);
      _dummy.updateMatrix();
      this.sprayMesh.setMatrixAt(i, _dummy.matrix);
      this.sprayMesh.setColorAt(i, p.color);
    }
    if (anyChanged) {
      this.sprayMesh.instanceMatrix.needsUpdate = true;
      if (this.sprayMesh.instanceColor) this.sprayMesh.instanceColor.needsUpdate = true;
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
      cf.vy -= 3.8 * dt;
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
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.15);
    const shake = this.cameraTrauma * this.cameraTrauma;
    const shakeX = Math.sin(this.simTimeSec * 42) * shake * 0.16;
    const shakeY = Math.cos(this.simTimeSec * 37) * shake * 0.12;

    let aimX = Math.sin(this.simTimeSec * 0.38) * 0.16;
    let aimY = 1.82;
    const camZ = 9.75;
    const camY = 3.05;
    let desiredFov = 48;

    if (this.surferA.isWinner && !this.surferB.isWinner) {
      aimX = -0.38;
      aimY = 1.92;
    } else if (this.surferB.isWinner && !this.surferA.isWinner) {
      aimX = 0.38;
      aimY = 1.92;
    } else {
      desiredFov = 48 + (this.surferA.surgeEnergy + this.surferB.surgeEnergy) * 0.9;
    }

    _camTargetPos.set(aimX * 0.35 + shakeX, camY + shakeY, camZ);
    _camTargetLook.set(aimX, aimY, -2.5);

    const k = 1 - Math.exp(-4.8 * dt);
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

    disposeSurferRig(this.surferA.rig);
    disposeSurferRig(this.surferB.rig);
    this.texturePack.dispose();
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
