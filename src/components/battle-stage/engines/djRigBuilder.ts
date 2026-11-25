import * as THREE from "three";
import type { Side, SurferStyle, WearableId } from "@/lib/games/battle-logic";
import {
  type DjTexturePack,
  type SideDecalPack,
  createSideDecalTextures,
} from "./proceduralTextures";
import type { WearableRig } from "./surferBuilder";

export interface DjRig {
  side: Side;
  style: SurferStyle;
  root: THREE.Group;
  deckGroup: THREE.Group;
  vinylPlatterGroup: THREE.Group;
  tonearmGroup: THREE.Group;
  faderCapMesh: THREE.Mesh;
  padMeshes: THREE.Mesh[];
  bodyGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  scratchArm: THREE.Group;
  faderArm: THREE.Group;
  contactShadow: THREE.Mesh;
  visorMesh: THREE.Mesh;
  visorMaterial: THREE.MeshStandardMaterial;
  slipmatMesh: THREE.Mesh;
  slipmatMaterial: THREE.MeshStandardMaterial;
  glitchOverlayMesh: THREE.Mesh;
  glitchOverlayMaterial: THREE.MeshBasicMaterial;
  teamGlowMaterial: THREE.MeshStandardMaterial;
  stylusGlowMaterial: THREE.MeshBasicMaterial;
  queenCrestGroup: THREE.Group;
  proCrestGroup: THREE.Group;
  speakerCones: THREE.Mesh[];
  speakerEqBars: THREE.Mesh[];
  wingPodGroup: THREE.Group;
  wingPodScale: number;
  wingPodActive: boolean;
  speakerStackHighGroup: THREE.Group;
  speakerStackHighScale: number;
  speakerStackHighActive: boolean;
  wearables: Record<WearableId, WearableRig>;
  currentTexture: THREE.Texture | null;
  flipX: boolean;
  disposables: Array<{ dispose: () => void }>;
}

const SIDE_COLORS: Record<
  Side,
  { primary: number; armorTint: number; deep: number; trim: number }
> = {
  A: { primary: 0x7ec1fb, armorTint: 0x3d6896, deep: 0x132c4f, trim: 0x7ec1fb },
  B: { primary: 0x95fe7c, armorTint: 0x317075, deep: 0x113f42, trim: 0x95fe7c },
};

function createSculptedTorsoGeometry(style: SurferStyle): THREE.LatheGeometry {
  const isQueen = style === "queen";
  const shoulderR = isQueen ? 0.34 : 0.41;
  const chestR = isQueen ? 0.31 : 0.38;
  const waistR = isQueen ? 0.21 : 0.27;
  const hipR = isQueen ? 0.26 : 0.28;

  const pts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(hipR * 0.92, 0.04),
    new THREE.Vector2(hipR, 0.14),
    new THREE.Vector2(waistR, 0.28),
    new THREE.Vector2(waistR * 1.06, 0.39),
    new THREE.Vector2(chestR, 0.54),
    new THREE.Vector2(shoulderR, 0.66),
    new THREE.Vector2(shoulderR * 0.72, 0.72),
    new THREE.Vector2(0.15, 0.77),
    new THREE.Vector2(0.01, 0.79),
  ];

  const geo = new THREE.LatheGeometry(pts, 24);
  geo.scale(1.16, 1.0, 0.75);
  geo.computeVertexNormals();
  return geo;
}

function createChestCuirassGeometry(style: SurferStyle): THREE.ExtrudeGeometry {
  const w = style === "queen" ? 0.33 : 0.39;
  const shape = new THREE.Shape();
  shape.moveTo(-w * 0.62, -0.18);
  shape.lineTo(w * 0.62, -0.18);
  shape.lineTo(w, 0.06);
  shape.lineTo(w * 0.86, 0.24);
  shape.lineTo(w * 0.35, 0.27);
  shape.lineTo(0, 0.21);
  shape.lineTo(-w * 0.35, 0.27);
  shape.lineTo(-w * 0.86, 0.24);
  shape.lineTo(-w, 0.06);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

function createCrystalWingBladeGeometry(
  span: number,
  sweepY: number,
  rootChord: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(span * 0.48, sweepY * 0.42 + rootChord * 0.18);
  shape.lineTo(span, sweepY);
  shape.lineTo(span * 0.72, sweepY - rootChord * 0.55);
  shape.lineTo(span * 0.25, sweepY * 0.2 - rootChord * 0.78);
  shape.lineTo(0, -rootChord * 0.68);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  geo.computeVertexNormals();
  return geo;
}

function createWingGeometry(span: number, sweep: number, chord: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(span * 0.4, -sweep * 0.25, span * 0.8, -sweep * 0.65, span, -sweep);
  shape.lineTo(span * 0.85, -sweep - chord * 0.48);
  shape.bezierCurveTo(
    span * 0.45,
    -sweep * 0.45 - chord * 0.65,
    span * 0.15,
    -chord * 0.88,
    0,
    -chord,
  );
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  geo.computeVertexNormals();
  return geo;
}

function createShadesGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.35, 0.075);
  shape.lineTo(0.35, 0.075);
  shape.lineTo(0.31, -0.045);
  shape.lineTo(0.095, -0.05);
  shape.lineTo(0, -0.005);
  shape.lineTo(-0.095, -0.05);
  shape.lineTo(-0.31, -0.045);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  geo.computeVertexNormals();
  return geo;
}

function createRadialContactTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(120, 210, 255, 0.45)");
    grad.addColorStop(0.58, "rgba(56, 210, 255, 0.16)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildDjRig(
  side: Side,
  style: SurferStyle,
  initialAlbumSource: string | HTMLCanvasElement | null,
  maxAnisotropy: number,
  djTextures: DjTexturePack,
  neopreneBump: THREE.Texture | null = null,
  armorAlbedo: THREE.Texture | null = null,
  armorBump: THREE.Texture | null = null,
): DjRig {
  const palette = SIDE_COLORS[side];
  const isA = side === "A";
  const facingSign = isA ? 1 : -1;
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const decals: SideDecalPack = track(createSideDecalTextures(side, maxAnisotropy));

  const speakerCones: THREE.Mesh[] = [];
  const speakerEqBars: THREE.Mesh[] = [];
  const padMeshes: THREE.Mesh[] = [];

  const wetsuitMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x0f1622,
      roughness: 0.84,
      metalness: 0.14,
      bumpMap: neopreneBump,
      bumpScale: 0.022,
      roughnessMap: neopreneBump,
    }),
  );

  const armorMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: palette.armorTint,
      map: armorAlbedo,
      bumpMap: armorBump,
      bumpScale: 0.02,
      roughnessMap: armorBump,
      roughness: 0.42,
      metalness: 0.76,
      clearcoat: 0.48,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.08,
    }),
  );

  const deckChassisMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x101826,
      roughness: 0.28,
      metalness: 0.78,
      clearcoat: 0.75,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.1,
    }),
  );

  const metalTrimMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xc8d8eb,
      roughness: 0.2,
      metalness: 0.94,
      clearcoat: 0.5,
      envMapIntensity: 1.25,
    }),
  );

  const darkAnodizedMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x162132,
      roughness: 0.44,
      metalness: 0.82,
    }),
  );

  const cabinetMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x0c121e,
      roughness: 0.72,
      metalness: 0.34,
    }),
  );

  const speakerGrilleMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x263246,
      map: djTextures.speakerGrilleMap,
      roughness: 0.6,
      metalness: 0.6,
    }),
  );

  const coneMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x182132,
      roughness: 0.36,
      metalness: 0.45,
      clearcoat: 0.6,
    }),
  );

  const teamGlowMaterial = track(
    new THREE.MeshStandardMaterial({
      color: palette.primary,
      emissive: palette.primary,
      emissiveIntensity: 1.3,
      roughness: 0.2,
      metalness: 0.2,
    }),
  );

  const goldMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xe5c25a,
      emissive: 0xffb703,
      emissiveIntensity: 0.52,
      roughness: 0.16,
      metalness: 0.92,
      clearcoat: 0.6,
    }),
  );

  const chestEqMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: decals.eqChestMap,
      emissive: 0xffffff,
      emissiveMap: decals.eqChestMap,
      emissiveIntensity: 1.2,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );

  const shoulderEqMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: decals.eqShoulderMap,
      emissive: 0xffffff,
      emissiveMap: decals.eqShoulderMap,
      emissiveIntensity: 1.2,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );

  const visorMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x091326,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.0,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    }),
  );

  const slipmatMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x091326,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.0,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const root = new THREE.Group();
  root.name = `dj_${side}`;

  // 1. Floor Projector Glow Halo beneath DJ Station
  const contactTex = track(createRadialContactTexture());
  const contactShadow = new THREE.Mesh(
    track(new THREE.CircleGeometry(2.05, 32)),
    track(
      new THREE.MeshBasicMaterial({
        map: contactTex,
        color: palette.primary,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      }),
    ),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Helper to construct a speaker woofer unit whose central cone visibly pistons
  const createWooferUnit = (radius: number): THREE.Group => {
    const u = new THREE.Group();
    const surround = new THREE.Mesh(
      track(new THREE.TorusGeometry(radius, radius * 0.12, 10, 28)),
      darkAnodizedMaterial,
    );
    u.add(surround);

    const glowTrim = new THREE.Mesh(
      track(new THREE.TorusGeometry(radius * 1.08, radius * 0.055, 8, 28)),
      teamGlowMaterial,
    );
    u.add(glowTrim);

    const coneGroup = new THREE.Mesh(
      track(new THREE.ConeGeometry(radius * 0.88, radius * 0.28, 22)),
      coneMaterial,
    );
    coneGroup.rotation.x = -Math.PI / 2;
    coneGroup.position.z = -radius * 0.06;
    u.add(coneGroup);

    const dustCap = new THREE.Mesh(
      track(new THREE.SphereGeometry(radius * 0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      teamGlowMaterial,
    );
    dustCap.rotation.x = Math.PI / 2;
    dustCap.position.y = -radius * 0.14;
    coneGroup.add(dustCap);

    speakerCones.push(coneGroup);
    return u;
  };

  // Helper to build a sleek vertical EQ bar column along a speaker cabinet
  const addEqColumn = (parent: THREE.Group, x: number, yStart: number, z: number, count: number, stepY: number) => {
    const barGeo = track(new THREE.BoxGeometry(0.085, stepY * 0.56, 0.025));
    for (let i = 0; i < count; i++) {
      const mat = track(
        new THREE.MeshBasicMaterial({
          color: i >= count - 2 ? 0xe5c25a : palette.primary,
          transparent: true,
          opacity: 0.9,
        }),
      );
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set(x, yStart + i * stepY, z);
      bar.userData.eqIndex = i / Math.max(1, count - 1);
      parent.add(bar);
      speakerEqBars.push(bar);
    }
  };

  // 2. Angled Floating Holographic Turntable & Mixer Console (front hero feature!)
  const deckGroup = new THREE.Group();
  deckGroup.position.set(0, 1.12, 0.56);
  deckGroup.rotation.x = 0.36; // tilted cleanly toward broadcast camera so spinning vinyl & tonearm pop!
  root.add(deckGroup);

  // Floating Hover Thruster Pylon + Under-glow Strip holding the console aloft
  const consoleBasePlate = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.94, 0.14, 1.08)),
    deckChassisMaterial,
  );
  consoleBasePlate.castShadow = true;
  consoleBasePlate.receiveShadow = true;
  deckGroup.add(consoleBasePlate);

  // Glowing outer LED console rails
  const deckRimMesh = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.98, 0.045, 1.12)),
    teamGlowMaterial,
  );
  deckRimMesh.position.y = -0.02;
  deckGroup.add(deckRimMesh);

  // Under-deck levitation emitter ring + translucent holographic support beam
  const hoverRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.46, 0.024, 8, 28)),
    teamGlowMaterial,
  );
  hoverRing.rotation.x = Math.PI / 2;
  hoverRing.position.y = -0.1;
  deckGroup.add(hoverRing);

  const hoverBeam = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.18, 0.36, 1.02, 16, 1, true)),
    track(
      new THREE.MeshBasicMaterial({
        color: palette.primary,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
  );
  hoverBeam.position.set(0, 0.52, 0.54);
  root.add(hoverBeam);

  // Faceplate overlay cleanly mapped onto deck top
  const faceplateMesh = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.86, 1.0)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: djTextures.mixerFaceMap,
        roughness: 0.45,
        metalness: 0.4,
      }),
    ),
  );
  faceplateMesh.rotation.x = -Math.PI / 2;
  faceplateMesh.position.y = 0.072;
  deckGroup.add(faceplateMesh);

  // Left/Right side symmetry: Turntable Outboard, Mixer Pod Inboard
  const vinylX = -facingSign * 0.28;
  const mixerX = facingSign * 0.54;

  // Platter Recessed LED Halo Ring
  const platterHalo = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.515, 0.02, 10, 40)),
    teamGlowMaterial,
  );
  platterHalo.rotation.x = Math.PI / 2;
  platterHalo.position.set(vinylX, 0.078, 0.02);
  deckGroup.add(platterHalo);

  // Spinning Vinyl Platter Group
  const vinylPlatterGroup = new THREE.Group();
  vinylPlatterGroup.position.set(vinylX, 0.095, 0.02);
  deckGroup.add(vinylPlatterGroup);

  const metalPlatter = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.48, 0.495, 0.04, 40)),
    metalTrimMaterial,
  );
  vinylPlatterGroup.add(metalPlatter);

  const vinylGroovesMesh = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.465, 42)),
    track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: djTextures.vinylGrooveMap,
        roughness: 0.22,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      }),
    ),
  );
  vinylGroovesMesh.rotation.x = -Math.PI / 2;
  vinylGroovesMesh.position.y = 0.022;
  vinylPlatterGroup.add(vinylGroovesMesh);

  // Matte glare-free Spinning Artist Album Art Slipmat Label in Vinyl Center
  const slipmatMesh = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.245, 36)),
    slipmatMaterial,
  );
  slipmatMesh.rotation.x = -Math.PI / 2;
  slipmatMesh.position.y = 0.026;
  vinylPlatterGroup.add(slipmatMesh);

  const slipmatBorderRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.246, 0.012, 8, 36)),
    teamGlowMaterial,
  );
  slipmatBorderRing.rotation.x = Math.PI / 2;
  slipmatBorderRing.position.y = 0.026;
  vinylPlatterGroup.add(slipmatBorderRing);

  const spindlePin = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.018, 0.022, 0.046, 12)),
    goldMaterial,
  );
  spindlePin.position.y = 0.042;
  vinylPlatterGroup.add(spindlePin);

  // Articulated Glowing S-Tonearm & Needle Stylus tracking the Vinyl Grooves
  const tonearmPivotX = vinylX + (isA ? -0.44 : 0.44);
  const tonearmGroup = new THREE.Group();
  tonearmGroup.position.set(tonearmPivotX, 0.13, -0.34);
  deckGroup.add(tonearmGroup);

  const gimbalBase = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.068, 0.082, 0.06, 16)),
    metalTrimMaterial,
  );
  tonearmGroup.add(gimbalBase);

  const gimbalRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.072, 0.012, 8, 20)),
    teamGlowMaterial,
  );
  gimbalRing.rotation.x = Math.PI / 2;
  gimbalRing.position.y = 0.024;
  tonearmGroup.add(gimbalRing);

  // S-curved chrome tube reaching neatly over the outer vinyl grooves + counterweight & glowing headshell
  const armSign = isA ? 1 : -1;
  const counterweight = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.036, 0.036, 0.075, 12)),
    metalTrimMaterial,
  );
  counterweight.rotation.x = Math.PI / 2;
  counterweight.position.set(0, 0.036, -0.075);
  tonearmGroup.add(counterweight);

  const sCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.036, -0.05),
    new THREE.Vector3(0, 0.048, 0.09),
    new THREE.Vector3(armSign * 0.095, 0.044, 0.24),
    new THREE.Vector3(armSign * 0.065, 0.038, 0.4),
    new THREE.Vector3(armSign * 0.14, 0.028, 0.5),
  ]);
  const armTube = new THREE.Mesh(
    track(new THREE.TubeGeometry(sCurve, 24, 0.018, 8, false)),
    metalTrimMaterial,
  );
  tonearmGroup.add(armTube);

  const headshell = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.056, 0.032, 0.096)),
    darkAnodizedMaterial,
  );
  headshell.position.set(armSign * 0.15, 0.026, 0.515);
  headshell.rotation.y = armSign * 0.35;
  tonearmGroup.add(headshell);

  const headshellLed = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.044, 0.014, 0.056)),
    teamGlowMaterial,
  );
  headshellLed.position.set(armSign * 0.15, 0.044, 0.515);
  headshellLed.rotation.y = armSign * 0.35;
  tonearmGroup.add(headshellLed);

  const stylusGlowMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    }),
  );
  const stylusTip = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.022, 0.048, 10)),
    stylusGlowMaterial,
  );
  stylusTip.rotation.x = Math.PI;
  stylusTip.position.set(armSign * 0.16, 0.004, 0.53);
  tonearmGroup.add(stylusTip);

  // Integrated 2-Channel DJ Mixer Strip + Sliding Crossfader + Hot-Cue Pads
  const faderTrack = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.32, 0.016, 0.034)),
    darkAnodizedMaterial,
  );
  faderTrack.position.set(mixerX, 0.078, 0.34);
  deckGroup.add(faderTrack);

  const faderCapMesh = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.056, 0.046, 0.088)),
    teamGlowMaterial,
  );
  faderCapMesh.position.set(mixerX, 0.102, 0.34);
  deckGroup.add(faderCapMesh);

  // Upfaders + EQ Knobs
  const knobGeo = track(new THREE.CylinderGeometry(0.028, 0.032, 0.038, 12));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const knob = new THREE.Mesh(knobGeo, metalTrimMaterial);
      knob.position.set(mixerX + (c === 0 ? -0.12 : 0.12), 0.09, -0.32 + r * 0.12);
      deckGroup.add(knob);
    }
  }

  // 4 Backlit RGB Trigger Pads on front edge of deck
  const padGeo = track(new THREE.BoxGeometry(0.11, 0.02, 0.11));
  for (let i = 0; i < 4; i++) {
    const padMat = track(
      new THREE.MeshStandardMaterial({
        color: palette.primary,
        emissive: palette.primary,
        emissiveIntensity: 0.72,
        roughness: 0.25,
      }),
    );
    const pad = new THREE.Mesh(padGeo, padMat);
    const row = Math.floor(i / 2);
    const col = i % 2;
    pad.position.set(mixerX + (col === 0 ? -0.08 : 0.08), 0.082, 0.04 + row * 0.13);
    deckGroup.add(pad);
    padMeshes.push(pad);
  }

  // LV.1 Compact Desktop Stage Monitors mounted on the outer shoulders of the DJ Booth
  for (const mDir of [-1, 1] as const) {
    const miniMonitor = new THREE.Group();
    miniMonitor.position.set(mDir * 0.92, 0.16, -0.34);
    miniMonitor.rotation.y = -mDir * 0.28;
    miniMonitor.rotation.x = -0.18;
    deckGroup.add(miniMonitor);

    const box = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.24, 0.32, 0.24)),
      cabinetMaterial,
    );
    miniMonitor.add(box);

    const woofer = createWooferUnit(0.086);
    woofer.position.set(0, -0.04, 0.125);
    miniMonitor.add(woofer);

    const tweeter = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.036, 0.01, 8, 16)),
      teamGlowMaterial,
    );
    tweeter.position.set(0, 0.09, 0.125);
    miniMonitor.add(tweeter);
  }

  // Outboard Level-2 Expanding Monitor Wing Pods (mounted cleanly onto console armature at LV.2+)
  const wingPodGroup = new THREE.Group();
  const wingArm = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.32, 0.06, 0.08)),
    metalTrimMaterial,
  );
  wingArm.position.set(-facingSign * 0.98, 1.1, 0.24);
  wingPodGroup.add(wingArm);

  const podBox = new THREE.Group();
  podBox.position.set(-facingSign * 1.18, 1.18, 0.18);
  podBox.rotation.y = facingSign * 0.32;
  wingPodGroup.add(podBox);

  const podBody = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.42, 0.56, 0.42)),
    cabinetMaterial,
  );
  podBox.add(podBody);
  const podGrill = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.36, 0.5)),
    speakerGrilleMat,
  );
  podGrill.position.z = 0.212;
  podBox.add(podGrill);
  const podWoofer = createWooferUnit(0.15);
  podWoofer.position.set(0, -0.05, 0.22);
  podBox.add(podWoofer);
  addEqColumn(podBox, -facingSign * 0.22, -0.2, 0.22, 6, 0.08);
  wingPodGroup.scale.setScalar(0.0001);
  wingPodGroup.visible = false;
  root.add(wingPodGroup);

  // 3. Articulated Robotic DJ Standing Behind Console
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.04, -0.32);
  root.add(bodyGroup);

  // Sleek mechanical DJ legs anchored to stage behind console
  for (const dir of [-1, 1] as const) {
    const legUpper = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.12, 0.105, 0.42, 12)),
      wetsuitMaterial,
    );
    legUpper.position.set(dir * 0.2, 0.64, 0);
    bodyGroup.add(legUpper);

    const legShin = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.11, 0.095, 0.44, 12)),
      armorMaterial,
    );
    legShin.position.set(dir * 0.21, 0.24, 0.02);
    legShin.castShadow = true;
    bodyGroup.add(legShin);

    const boot = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.1, 0.3)),
      darkAnodizedMaterial,
    );
    boot.position.set(dir * 0.21, 0.05, 0.06);
    bodyGroup.add(boot);
  }

  const pelvis = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.25, 0.26, 0.22, 14)),
    armorMaterial,
  );
  pelvis.scale.set(1.14, 1, 0.8);
  pelvis.position.set(0, 0.88, 0);
  bodyGroup.add(pelvis);

  // Torso rising cleanly above the angled console
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.96, 0);
  bodyGroup.add(torsoGroup);

  const torsoCore = new THREE.Mesh(
    track(createSculptedTorsoGeometry(style)),
    wetsuitMaterial,
  );
  torsoCore.castShadow = true;
  torsoGroup.add(torsoCore);

  const cuirass = new THREE.Mesh(
    track(createChestCuirassGeometry(style)),
    armorMaterial,
  );
  cuirass.position.set(0, 0.46, 0.14);
  cuirass.castShadow = true;
  torsoGroup.add(cuirass);

  const chestFrame = new THREE.Mesh(
    track(new THREE.BoxGeometry(style === "queen" ? 0.42 : 0.5, 0.26, 0.04)),
    darkAnodizedMaterial,
  );
  chestFrame.position.set(0, 0.46, 0.258);
  torsoGroup.add(chestFrame);

  const chestEqScreen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(style === "queen" ? 0.38 : 0.46, 0.22)),
    chestEqMaterial,
  );
  chestEqScreen.position.set(0, 0.46, 0.28);
  torsoGroup.add(chestEqScreen);

  const collarRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.2, 0.048, 10, 24)),
    armorMaterial,
  );
  collarRing.rotation.x = Math.PI / 2 - 0.12;
  collarRing.position.set(0, 0.72, 0.02);
  torsoGroup.add(collarRing);

  // Robotic DJ Arms positioned forward so one scratches the platter & one works the mixer!
  const shoulderX = style === "queen" ? 0.38 : 0.43;
  const createDjArm = (sideDir: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(sideDir * shoulderX, 0.62, 0.04);

    const pauldronDome = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68)),
      armorMaterial,
    );
    pauldronDome.scale.set(1.1, 0.98, 1.15);
    pauldronDome.rotation.z = -sideDir * 0.44;
    pauldronDome.castShadow = true;
    arm.add(pauldronDome);

    const pauldronRim = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.175, 0.018, 8, 22)),
      teamGlowMaterial,
    );
    pauldronRim.rotation.x = Math.PI / 2;
    pauldronRim.rotation.y = -sideDir * 0.44;
    pauldronRim.position.set(sideDir * 0.03, -0.02, 0);
    arm.add(pauldronRim);

    const shoulderEqBadge = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.15, 0.15)),
      shoulderEqMaterial,
    );
    shoulderEqBadge.position.set(sideDir * 0.18, 0.04, 0.08);
    shoulderEqBadge.rotation.y = sideDir * 0.92;
    shoulderEqBadge.rotation.x = -0.22;
    arm.add(shoulderEqBadge);

    const upperArmCore = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.095, 0.082, 0.34, 12)),
      wetsuitMaterial,
    );
    upperArmCore.position.set(sideDir * 0.06, -0.17, 0.09);
    upperArmCore.rotation.x = -0.58;
    upperArmCore.rotation.z = sideDir * 0.24;
    arm.add(upperArmCore);

    const elbowArmor = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.12, 0.12, 0.13)),
      darkAnodizedMaterial,
    );
    elbowArmor.position.set(sideDir * 0.09, -0.32, 0.21);
    arm.add(elbowArmor);

    // Forearm bent sharply forward over the DJ turntable console
    const forearm = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.105, 0.084, 0.4, 10)),
      armorMaterial,
    );
    forearm.position.set(sideDir * 0.04, -0.37, 0.42);
    forearm.rotation.x = -1.34;
    forearm.rotation.z = sideDir * 0.18;
    arm.add(forearm);

    const bracerGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.03, 0.03, 0.24)),
      teamGlowMaterial,
    );
    bracerGlow.position.set(sideDir * 0.04, -0.34, 0.44);
    arm.add(bracerGlow);

    const mechGlove = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.13, 0.1, 0.15)),
      darkAnodizedMaterial,
    );
    mechGlove.position.set(0, -0.4, 0.64);
    arm.add(mechGlove);

    return arm;
  };

  const leftArmGroup = createDjArm(-1);
  const rightArmGroup = createDjArm(1);
  torsoGroup.add(leftArmGroup, rightArmGroup);

  const scratchArm = isA ? leftArmGroup : rightArmGroup;
  const faderArm = isA ? rightArmGroup : leftArmGroup;

  // 4. Robotic DJ Helmet + Recessed Shell + Glare-Free Holographic Album Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.02, 0.05);
  torsoGroup.add(headGroup);

  const neckConduit = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.125, 0.15, 0.2, 14)),
    wetsuitMaterial,
  );
  neckConduit.position.set(0, -0.24, -0.02);
  headGroup.add(neckConduit);

  const helmetShell = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.39, 24, 18)),
    armorMaterial,
  );
  // Recessed shell front apex (+0.180) strictly behind screenBack/visor (+0.238/+0.258)
  helmetShell.scale.set(1.06, 1.05, 0.68);
  helmetShell.position.z = -0.085;
  helmetShell.castShadow = true;
  headGroup.add(helmetShell);

  for (const dir of [-1, 1] as const) {
    const cheekGuard = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.13, 0.22, 0.24)),
      darkAnodizedMaterial,
    );
    cheekGuard.position.set(dir * 0.34, -0.1, 0.08);
    cheekGuard.rotation.y = dir * 0.44;
    headGroup.add(cheekGuard);
  }

  const outerHousingRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.355, 0.046, 12, 36)),
    darkAnodizedMaterial,
  );
  outerHousingRing.position.set(0, 0, 0.228);
  headGroup.add(outerHousingRing);

  const bezelRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.334, 0.022, 10, 36)),
    teamGlowMaterial,
  );
  bezelRing.position.set(0, 0, 0.248);
  headGroup.add(bezelRing);

  const screenBack = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.332, 36)),
    track(new THREE.MeshBasicMaterial({ color: 0x050914 })),
  );
  screenBack.position.set(0, 0, 0.238);
  headGroup.add(screenBack);

  const visorMesh = new THREE.Mesh(track(new THREE.CircleGeometry(0.324, 36)), visorMaterial);
  visorMesh.position.set(0, 0, 0.258);
  headGroup.add(visorMesh);

  // Brief Sell Static Glitch Flicker Mesh (0 opacity except on Sell trigger)
  const glitchOverlayMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0xff3b5c,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const glitchOverlayMesh = new THREE.Mesh(
    track(new THREE.RingGeometry(0.18, 0.332, 32)),
    glitchOverlayMaterial,
  );
  glitchOverlayMesh.position.set(0, 0, 0.262);
  headGroup.add(glitchOverlayMesh);

  const proCrestGroup = new THREE.Group();
  const finCrest = new THREE.Mesh(
    track(createWingGeometry(0.25, 0.19, 0.28)),
    teamGlowMaterial,
  );
  finCrest.rotation.y = Math.PI / 2;
  finCrest.position.set(-0.018, 0.39, 0.02);
  proCrestGroup.add(finCrest);
  proCrestGroup.visible = style === "pro";
  headGroup.add(proCrestGroup);

  const queenCrestGroup = new THREE.Group();
  for (const dir of [-1, 1] as const) {
    const ribbon = new THREE.Mesh(
      track(createWingGeometry(0.35, 0.3, 0.16)),
      teamGlowMaterial,
    );
    ribbon.position.set(dir * 0.28, 0.24, -0.14);
    ribbon.rotation.y = dir * 0.45;
    ribbon.rotation.z = -dir * 0.45;
    ribbon.scale.x = dir;
    queenCrestGroup.add(ribbon);
  }
  queenCrestGroup.visible = style === "queen";
  headGroup.add(queenCrestGroup);

  // 5. Progressive Wearables & Escalating Speaker Stacks (LV.2 -> LV.5)
  // LV.2: Studio DJ Cans on Helmet
  const headphonesGroup = new THREE.Group();
  const headband = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.46, 0.044, 12, 32, Math.PI * 1.08)),
    darkAnodizedMaterial,
  );
  headband.rotation.z = -Math.PI * 0.04;
  headphonesGroup.add(headband);
  for (const dir of [-1, 1] as const) {
    const cup = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.175, 0.165, 0.095, 18)),
      armorMaterial,
    );
    cup.rotation.z = Math.PI / 2;
    cup.position.set(dir * 0.45, 0, 0.02);
    headphonesGroup.add(cup);

    const cupGlow = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.145, 0.022, 8, 24)),
      teamGlowMaterial,
    );
    cupGlow.rotation.y = Math.PI / 2;
    cupGlow.position.set(dir * 0.505, 0, 0.02);
    headphonesGroup.add(cupGlow);

    const cupInnerWave = new THREE.Mesh(
      track(new THREE.CircleGeometry(0.13, 20)),
      track(
        new THREE.MeshBasicMaterial({
          map: decals.waveformMap,
          color: palette.primary,
          transparent: true,
          opacity: 0.92,
        }),
      ),
    );
    cupInnerWave.rotation.y = dir * (Math.PI / 2);
    cupInnerWave.position.set(dir * 0.508, 0, 0.02);
    headphonesGroup.add(cupInnerWave);
  }
  headphonesGroup.scale.setScalar(0.0001);
  headphonesGroup.visible = false;
  headGroup.add(headphonesGroup);

  // LV.3: Prism Visor Shades
  const shadesGroup = new THREE.Group();
  const shadesLensMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xe5c25a,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.85,
      clearcoat: 1.0,
      iridescence: 0.9,
      iridescenceIOR: 1.4,
    }),
  );
  const shadesMesh = new THREE.Mesh(track(createShadesGeometry()), shadesLensMat);
  shadesMesh.position.set(0, 0.32, 0.268);
  shadesGroup.add(shadesMesh);
  shadesGroup.scale.setScalar(0.0001);
  shadesGroup.visible = false;
  headGroup.add(shadesGroup);

  // LV.3: Rising EQ Speaker Stack (positioned cleanly outboard so stack + woofers + EQ bars stand unobstructed!)
  const speakerStackMidGroup = new THREE.Group();
  const stackPed = new THREE.Group();
  stackPed.position.set(-facingSign * 1.74, 0.0, -0.22);
  stackPed.rotation.y = facingSign * 0.34;
  speakerStackMidGroup.add(stackPed);

  const midCab = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.82, 2.05, 0.66)),
    cabinetMaterial,
  );
  midCab.position.y = 1.03;
  midCab.castShadow = true;
  stackPed.add(midCab);

  const midRim = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.86, 2.08, 0.04)),
    teamGlowMaterial,
  );
  midRim.position.set(0, 1.03, 0.31);
  stackPed.add(midRim);

  const midGrill = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.7, 1.9)),
    speakerGrilleMat,
  );
  midGrill.position.set(0, 1.03, 0.335);
  stackPed.add(midGrill);

  const midWooferBot = createWooferUnit(0.3);
  midWooferBot.position.set(0, 0.56, 0.345);
  stackPed.add(midWooferBot);

  const midWooferTop = createWooferUnit(0.26);
  midWooferTop.position.set(0, 1.46, 0.345);
  stackPed.add(midWooferTop);

  addEqColumn(stackPed, -facingSign * 0.48, 0.24, 0.34, 10, 0.17);
  speakerStackMidGroup.scale.setScalar(0.0001);
  speakerStackMidGroup.visible = false;
  root.add(speakerStackMidGroup);

  // LV.4: Upper Line-Array Speaker Stack + Laser Crown
  const speakerStackHighGroup = new THREE.Group();
  const highPod = new THREE.Group();
  highPod.position.set(-facingSign * 1.74, 2.05, -0.22);
  highPod.rotation.y = facingSign * 0.34;
  speakerStackHighGroup.add(highPod);

  const highCab = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.74, 0.94, 0.58)),
    armorMaterial,
  );
  highCab.position.y = 0.47;
  highPod.add(highCab);

  const highWoofer = createWooferUnit(0.22);
  highWoofer.position.set(0, 0.47, 0.3);
  highPod.add(highWoofer);

  addEqColumn(highPod, -facingSign * 0.44, 0.15, 0.3, 5, 0.15);
  speakerStackHighGroup.scale.setScalar(0.0001);
  speakerStackHighGroup.visible = false;
  root.add(speakerStackHighGroup);

  const soundCrownGroup = new THREE.Group();
  soundCrownGroup.position.set(0, 0.5, 0.02);
  const crownRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.28, 0.022, 12, 32)),
    goldMaterial,
  );
  crownRing.rotation.x = Math.PI / 2;
  soundCrownGroup.add(crownRing);

  const crownProngs: THREE.Mesh[] = [];
  const prongGeo = track(new THREE.CylinderGeometry(0.015, 0.03, 0.19, 8));
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const prong = new THREE.Mesh(prongGeo, i % 2 === 0 ? goldMaterial : teamGlowMaterial);
    prong.position.set(Math.cos(angle) * 0.28, 0.1, Math.sin(angle) * 0.28);
    soundCrownGroup.add(prong);
    crownProngs.push(prong);
  }
  soundCrownGroup.scale.setScalar(0.0001);
  soundCrownGroup.visible = false;
  headGroup.add(soundCrownGroup);

  // LV.5: Full Arena Stage Subwoofer Wall + Holographic Laser Wings (reverbCape slot!)
  const laserWingsGroup = new THREE.Group();

  // Left/Right holographic Laser Wing blades behind DJ shoulders
  const wingAnchor = new THREE.Group();
  wingAnchor.position.set(0, 0.68, -0.28);
  laserWingsGroup.add(wingAnchor);

  const bladeTopGeo = track(createCrystalWingBladeGeometry(1.56, 1.45, 0.36));
  const bladeMidGeo = track(createCrystalWingBladeGeometry(1.66, 0.92, 0.32));
  const bladeLowGeo = track(createCrystalWingBladeGeometry(1.36, 0.38, 0.26));

  const crystalWingMat = track(
    new THREE.MeshPhysicalMaterial({
      color: palette.primary,
      emissive: palette.primary,
      emissiveIntensity: 1.45,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const waveformRibbonMat = track(
    new THREE.MeshBasicMaterial({
      map: decals.waveformMap,
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const wingBeamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    }),
  );

  const wingMeshes: THREE.Mesh[] = [];
  for (const dir of [-1, 1] as const) {
    const topVane = new THREE.Mesh(bladeTopGeo, crystalWingMat);
    topVane.position.set(dir * 0.16, 0.22, -0.02);
    topVane.rotation.y = -dir * 0.14;
    topVane.scale.x = dir;
    wingAnchor.add(topVane);
    wingMeshes.push(topVane);

    const midVane = new THREE.Mesh(bladeMidGeo, crystalWingMat);
    midVane.position.set(dir * 0.18, 0.06, -0.04);
    midVane.rotation.y = -dir * 0.18;
    midVane.scale.x = dir;
    wingAnchor.add(midVane);
    wingMeshes.push(midVane);

    const lowVane = new THREE.Mesh(bladeLowGeo, crystalWingMat);
    lowVane.position.set(dir * 0.16, -0.08, -0.06);
    lowVane.rotation.y = -dir * 0.22;
    lowVane.scale.x = dir;
    wingAnchor.add(lowVane);
    wingMeshes.push(lowVane);

    // Bright laser spine leading-edge spar for unmistakable silhouette against LED wall
    const topSpar = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.75, 0.045, 0.04)),
      wingBeamMat,
    );
    topSpar.position.set(dir * 0.9, 0.92, 0.0);
    topSpar.rotation.z = dir * 0.72;
    wingAnchor.add(topSpar);

    const midSpar = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.72, 0.04, 0.04)),
      wingBeamMat,
    );
    midSpar.position.set(dir * 0.94, 0.48, -0.02);
    midSpar.rotation.z = dir * 0.48;
    wingAnchor.add(midSpar);

    const waveBurst = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.42, 0.7)),
      waveformRibbonMat,
    );
    waveBurst.position.set(dir * 0.88, 0.48, 0.06);
    waveBurst.rotation.y = -dir * 0.12;
    waveBurst.rotation.z = dir * 0.26;
    wingAnchor.add(waveBurst);
  }

  laserWingsGroup.scale.setScalar(0.0001);
  laserWingsGroup.visible = false;
  torsoGroup.add(laserWingsGroup);

  const wearables: Record<WearableId, WearableRig> = {
    headphones: { group: headphonesGroup, currentScale: 0, targetActive: false },
    shades: { group: shadesGroup, currentScale: 0, targetActive: false },
    hydroWings: { group: speakerStackMidGroup, currentScale: 0, targetActive: false },
    soundCrown: { group: soundCrownGroup, currentScale: 0, targetActive: false, crownProngs },
    reverbCape: { group: laserWingsGroup, currentScale: 0, targetActive: false, wingMeshes },
  };

  const rig: DjRig = {
    side,
    style,
    root,
    deckGroup,
    vinylPlatterGroup,
    tonearmGroup,
    faderCapMesh,
    padMeshes,
    bodyGroup,
    torsoGroup,
    headGroup,
    leftArmGroup,
    rightArmGroup,
    scratchArm,
    faderArm,
    contactShadow,
    visorMesh,
    visorMaterial,
    slipmatMesh,
    slipmatMaterial,
    glitchOverlayMesh,
    glitchOverlayMaterial,
    teamGlowMaterial,
    stylusGlowMaterial,
    queenCrestGroup,
    proCrestGroup,
    speakerCones,
    speakerEqBars,
    wingPodGroup,
    wingPodScale: 0,
    wingPodActive: false,
    speakerStackHighGroup,
    speakerStackHighScale: 0,
    speakerStackHighActive: false,
    wearables,
    currentTexture: null,
    flipX: false,
    disposables,
  };

  if (initialAlbumSource) {
    updateDjAlbumTexture(rig, initialAlbumSource, false, maxAnisotropy);
  }

  return rig;
}

export function setDjStyle(rig: DjRig, style: SurferStyle): void {
  rig.style = style;
  rig.proCrestGroup.visible = style === "pro";
  rig.queenCrestGroup.visible = style === "queen";
}

function applyDjAlbumTexture(rig: DjRig, tex: THREE.Texture, maxAnisotropy: number): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.center.set(0.5, 0.5);
  tex.repeat.x = rig.flipX ? -1 : 1;
  tex.needsUpdate = true;

  const prev = rig.currentTexture;
  rig.currentTexture = tex;

  rig.visorMaterial.color.setHex(0xe5e5e5);
  rig.visorMaterial.emissive.setHex(0xffffff);
  rig.visorMaterial.emissiveIntensity = 0.6;
  rig.visorMaterial.map = tex;
  rig.visorMaterial.emissiveMap = tex;
  rig.visorMaterial.needsUpdate = true;

  rig.slipmatMaterial.color.setHex(0xededed);
  rig.slipmatMaterial.emissive.setHex(0xffffff);
  rig.slipmatMaterial.emissiveIntensity = 0.45;
  rig.slipmatMaterial.map = tex;
  rig.slipmatMaterial.emissiveMap = tex;
  rig.slipmatMaterial.needsUpdate = true;

  if (prev && prev !== tex) {
    prev.dispose();
  }
}

export function updateDjAlbumTexture(
  rig: DjRig,
  source: string | HTMLCanvasElement | null,
  flipX: boolean,
  maxAnisotropy: number,
): void {
  rig.flipX = flipX;
  if (!source) return;

  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(source);
    applyDjAlbumTexture(rig, tex, maxAnisotropy);
    return;
  }

  if (typeof source !== "string" || typeof Image === "undefined") return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const tex = new THREE.Texture(img);
    applyDjAlbumTexture(rig, tex, maxAnisotropy);
  };
  img.src = source;
}

export function setDjFlip(rig: DjRig, flipX: boolean): void {
  rig.flipX = flipX;
  if (rig.currentTexture) {
    rig.currentTexture.center.set(0.5, 0.5);
    rig.currentTexture.repeat.x = flipX ? -1 : 1;
    rig.currentTexture.needsUpdate = true;
  }
}

export function disposeDjRig(rig: DjRig): void {
  if (rig.currentTexture) {
    rig.currentTexture.dispose();
    rig.currentTexture = null;
  }
  for (const item of rig.disposables) {
    item.dispose();
  }
}
