import * as THREE from "three";
import type { Side, SurferStyle, WearableId } from "@/lib/games/battle-logic";
import { type SideDecalPack, createSideDecalTextures } from "./proceduralTextures";

export interface WearableRig {
  group: THREE.Group;
  currentScale: number;
  targetActive: boolean;
  crownProngs?: THREE.Mesh[];
  wingMeshes?: THREE.Mesh[];
}

export interface SurferRig {
  side: Side;
  style: SurferStyle;
  root: THREE.Group;
  boardGroup: THREE.Group;
  bodyGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  contactShadow: THREE.Mesh;
  visorMesh: THREE.Mesh;
  visorMaterial: THREE.MeshStandardMaterial;
  teamGlowMaterial: THREE.MeshStandardMaterial;
  wetsuitMaterial: THREE.MeshStandardMaterial;
  armorMaterial: THREE.MeshPhysicalMaterial;
  queenCrestGroup: THREE.Group;
  proCrestGroup: THREE.Group;
  wearables: Record<WearableId, WearableRig>;
  currentTexture: THREE.Texture | null;
  flipX: boolean;
  disposables: Array<{ dispose: () => void }>;
}

const SIDE_COLORS: Record<
  Side,
  { primary: number; armorTint: number; deep: number; trim: number }
> = {
  A: { primary: 0x7ec1fb, armorTint: 0x4573a3, deep: 0x163963, trim: 0x7ec1fb },
  B: { primary: 0x95fe7c, armorTint: 0x38787d, deep: 0x14494a, trim: 0x95fe7c },
};

function evalBoardRocker(x: number, z: number): number {
  const normZ = z / 1.44;
  const rocker =
    normZ > 0
      ? Math.pow(normZ, 2.2) * 0.22 // aggressive pointed nose curl
      : Math.pow(-normZ, 2.3) * 0.085; // subtle tail kick
  const crown = Math.max(0, 1 - (x / 0.45) ** 2) * 0.014;
  return rocker + crown;
}

function makeBoardOutline2D(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.44);
  shape.bezierCurveTo(0.28, 1.1, 0.47, 0.36, 0.44, -0.36);
  shape.bezierCurveTo(0.41, -0.92, 0.3, -1.24, 0.16, -1.36);
  shape.lineTo(0.035, -1.24);
  shape.lineTo(-0.035, -1.24);
  shape.lineTo(-0.16, -1.36);
  shape.bezierCurveTo(-0.3, -1.24, -0.41, -0.92, -0.44, -0.36);
  shape.bezierCurveTo(-0.47, 0.36, -0.28, 1.1, 0, 1.44);
  return shape;
}

/**
 * Curved cyber shortboard hull with forward nose aligned along +Z.
 */
function createBoardGeometry(): THREE.ExtrudeGeometry {
  const shape = makeBoardOutline2D();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.068,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.024,
    bevelThickness: 0.022,
    curveSegments: 24,
  });
  // Map Shape +Y -> local +Z (forward surf nose), extrusion thickness -> +Y
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.068, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setY(i, y + evalBoardRocker(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Flush curved cyber-grid deck decal overlay with normalized [0..1] planar UVs.
 */
function createBoardDeckOverlayGeometry(): THREE.ShapeGeometry {
  const shape = makeBoardOutline2D();
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(-Math.PI / 2);
  // Wait: rotateX(-Math.PI/2) mapped Shape +Y to -Z, so rotateY(Math.PI) aligns +Y nose to +Z!
  geo.rotateY(Math.PI);

  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, 0.095 + evalBoardRocker(x, z));
    uvs[i * 2] = (x + 0.47) / 0.94;
    uvs[i * 2 + 1] = (z + 1.38) / 2.84;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Continuous neon edge tube hugging the curved outer surfboard rail & rocker.
 */
function createBoardNeonRailGeometry(scaleXZ = 1.035, yOffset = 0.052, radius = 0.024): THREE.TubeGeometry {
  const pts2d = makeBoardOutline2D().getSpacedPoints(48);
  const pts3d = pts2d.map((p) => {
    const x = p.x * scaleXZ;
    const z = p.y * 1.015;
    const y = yOffset + evalBoardRocker(x, z);
    return new THREE.Vector3(x, y, z);
  });
  const curve = new THREE.CatmullRomCurve3(pts3d, true);
  return new THREE.TubeGeometry(curve, 64, radius, 8, true);
}

function createSculptedTorsoGeometry(style: SurferStyle): THREE.LatheGeometry {
  const isQueen = style === "queen";
  const shoulderR = isQueen ? 0.34 : 0.42;
  const chestR = isQueen ? 0.31 : 0.39;
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
  geo.scale(1.18, 1.0, 0.76);
  geo.computeVertexNormals();
  return geo;
}

function createChestCuirassGeometry(style: SurferStyle): THREE.ExtrudeGeometry {
  const w = style === "queen" ? 0.33 : 0.4;
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
    bevelSize: 0.032,
    bevelThickness: 0.032,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

function createBootGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.095, -0.16);
  shape.lineTo(0.095, -0.16);
  shape.bezierCurveTo(0.115, -0.02, 0.105, 0.13, 0.065, 0.19);
  shape.quadraticCurveTo(0, 0.21, -0.065, 0.19);
  shape.bezierCurveTo(-0.105, 0.13, -0.115, -0.02, -0.095, -0.16);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.095,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.045, 0);
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
    depth: 0.03,
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
    depth: 0.042,
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
    const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(10, 35, 65, 0.58)");
    grad.addColorStop(0.55, "rgba(56, 210, 255, 0.22)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSurferRig(
  side: Side,
  style: SurferStyle,
  initialAlbumSource: string | HTMLCanvasElement | null,
  maxAnisotropy: number,
  neopreneBump: THREE.Texture | null = null,
  armorAlbedo: THREE.Texture | null = null,
  armorBump: THREE.Texture | null = null,
): SurferRig {
  const palette = SIDE_COLORS[side];
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const decals: SideDecalPack = track(createSideDecalTextures(side, maxAnisotropy));

  // Calibrated PBR Material Library (Ribbed Undersuit vs Weathered Brushed Armor vs Glowing Neon Trim)
  const wetsuitMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x101722,
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
      bumpScale: 0.022,
      roughnessMap: armorBump,
      roughness: 0.44,
      metalness: 0.72,
      clearcoat: 0.42,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.05,
    }),
  );

  const boardShellMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x111c2d,
      roughness: 0.22,
      metalness: 0.55,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.15,
    }),
  );

  const metalTrimMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xc8d8eb,
      roughness: 0.22,
      metalness: 0.92,
      clearcoat: 0.45,
      envMapIntensity: 1.25,
    }),
  );

  const darkAnodizedMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x182334,
      roughness: 0.42,
      metalness: 0.82,
    }),
  );

  const teamGlowMaterial = track(
    new THREE.MeshStandardMaterial({
      color: palette.primary,
      emissive: palette.primary,
      emissiveIntensity: 1.35,
      roughness: 0.18,
      metalness: 0.2,
    }),
  );

  const chestEqMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: decals.eqChestMap,
      emissive: 0xffffff,
      emissiveMap: decals.eqChestMap,
      emissiveIntensity: 1.25,
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
      emissiveIntensity: 1.25,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );

  const boardGridMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: decals.boardGridMap,
      emissive: 0xffffff,
      emissiveMap: decals.boardGridMap,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
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
      envMapIntensity: 1.2,
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

  const root = new THREE.Group();
  root.name = `surfer_${side}`;

  // 1. Contact caustic & wake grounding halo
  const contactTex = track(createRadialContactTexture());
  const contactShadow = new THREE.Mesh(
    track(new THREE.CircleGeometry(1.75, 28)),
    track(
      new THREE.MeshBasicMaterial({
        map: contactTex,
        color: palette.primary,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    ),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  // 2. Cyber-Mecha Double-Neon Hydro Surfboard (Hero Scale)
  const boardGroup = new THREE.Group();
  boardGroup.position.y = 0.22;
  boardGroup.scale.setScalar(1.12);
  root.add(boardGroup);

  const boardMesh = new THREE.Mesh(track(createBoardGeometry()), boardShellMaterial);
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  boardGroup.add(boardMesh);

  // Glowing perspective cyber-grid deck overlay
  const deckOverlay = new THREE.Mesh(
    track(createBoardDeckOverlayGeometry()),
    boardGridMaterial,
  );
  deckOverlay.scale.set(0.86, 1, 0.92);
  boardGroup.add(deckOverlay);

  // Double-neon glowing outer & upper bevel rails matching Ref 2
  const neonRail = new THREE.Mesh(
    track(createBoardNeonRailGeometry(1.04, 0.044, 0.024)),
    teamGlowMaterial,
  );
  boardGroup.add(neonRail);

  const upperNeonRail = new THREE.Mesh(
    track(createBoardNeonRailGeometry(0.95, 0.095, 0.015)),
    track(
      new THREE.MeshBasicMaterial({
        color: palette.trim,
        transparent: true,
        opacity: 0.94,
      }),
    ),
  );
  boardGroup.add(upperNeonRail);

  // Sculpted EVA traction pad + armored kicktail stop
  const gripPad = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.42, 0.018, 1.18)),
    wetsuitMaterial,
  );
  gripPad.position.set(0, 0.1, -0.2);
  boardGroup.add(gripPad);

  const tailKick = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.32, 0.056, 0.14)),
    armorMaterial,
  );
  tailKick.position.set(0, 0.135, -0.84);
  tailKick.rotation.x = -0.34;
  boardGroup.add(tailKick);

  // Swept glowing hydro-thruster fins underneath tail
  const finGeo = track(createWingGeometry(0.24, 0.16, 0.2));
  const finPositions: Array<[number, number, number]> = [
    [0, -0.02, -0.94],
    [-0.19, -0.02, -0.82],
    [0.19, -0.02, -0.82],
  ];
  for (const [fx, fy, fz] of finPositions) {
    const fin = new THREE.Mesh(finGeo, teamGlowMaterial);
    fin.rotation.y = Math.PI / 2;
    fin.rotation.x = Math.PI / 2;
    fin.position.set(fx, fy, fz);
    boardGroup.add(fin);
  }

  const facingSign = side === "A" ? 1 : -1;
  boardGroup.rotation.y = facingSign * 0.56;

  // 3. Heavy Cyber-Mecha Rider Assembly anchored onto deck
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.106, -0.08);
  boardGroup.add(bodyGroup);

  const bootGeo = track(createBootGeometry());

  // Heavy athletic bent-knee surfing crouch anchored cleanly to board deck
  const createLeg = (hipX: number, hipZ: number, kneePushZ: number) => {
    const leg = new THREE.Group();
    leg.position.set(hipX, 0.68, hipZ);

    const hipJoint = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.118, 14, 12)),
      wetsuitMaterial,
    );
    leg.add(hipJoint);

    const thighCore = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.128, 0.105, 0.35, 14)),
      wetsuitMaterial,
    );
    thighCore.position.set(0, -0.16, 0.07 * kneePushZ);
    thighCore.rotation.x = 0.44 * kneePushZ;
    thighCore.castShadow = true;
    leg.add(thighCore);

    const thighArmor = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.15, 0.126, 0.27, 10)),
      armorMaterial,
    );
    thighArmor.scale.set(1.04, 1, 1.15);
    thighArmor.position.set(0, -0.155, 0.08 * kneePushZ);
    thighArmor.rotation.x = 0.44 * kneePushZ;
    thighArmor.castShadow = true;
    leg.add(thighArmor);

    const thighTrim = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.032, 0.17, 0.03)),
      teamGlowMaterial,
    );
    thighTrim.position.set(hipX < 0 ? -0.14 : 0.14, -0.155, 0.14 * kneePushZ);
    thighTrim.rotation.x = 0.44 * kneePushZ;
    leg.add(thighTrim);

    const kneeArmor = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.185, 0.16, 0.175)),
      darkAnodizedMaterial,
    );
    kneeArmor.position.set(0, -0.32, 0.145 * kneePushZ);
    kneeArmor.rotation.x = 0.26 * kneePushZ;
    leg.add(kneeArmor);

    const shinCore = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.108, 0.088, 0.34, 14)),
      wetsuitMaterial,
    );
    shinCore.position.set(0, -0.49, 0.07 * kneePushZ);
    shinCore.rotation.x = -0.34 * kneePushZ;
    shinCore.castShadow = true;
    leg.add(shinCore);

    const shinGreave = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.126, 0.104, 0.28, 10)),
      armorMaterial,
    );
    shinGreave.position.set(0, -0.48, 0.085 * kneePushZ);
    shinGreave.rotation.x = -0.34 * kneePushZ;
    shinGreave.castShadow = true;
    leg.add(shinGreave);

    const shinGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.038, 0.21, 0.025)),
      teamGlowMaterial,
    );
    shinGlow.position.set(0, -0.48, 0.165);
    shinGlow.rotation.x = -0.34 * kneePushZ;
    leg.add(shinGlow);

    const boot = new THREE.Mesh(bootGeo, armorMaterial);
    boot.position.set(0, -0.68, 0.02);
    boot.castShadow = true;
    leg.add(boot);

    const bootSoleGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.205, 0.026, 0.35)),
      teamGlowMaterial,
    );
    bootSoleGlow.position.set(0, -0.695, 0.02);
    leg.add(bootSoleGlow);

    return leg;
  };

  const leftLegGroup = createLeg(-0.165, 0.36, 1);
  const rightLegGroup = createLeg(0.165, -0.36, 1);
  bodyGroup.add(leftLegGroup, rightLegGroup);

  // Armored tactical waist belt & pelvis codpiece
  const pelvis = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.25, 0.27, 0.24, 14)),
    armorMaterial,
  );
  pelvis.scale.set(1.16, 1, 0.82);
  pelvis.position.set(0, 0.78, 0);
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  const beltBuckle = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.18, 0.1, 0.07)),
    darkAnodizedMaterial,
  );
  beltBuckle.position.set(0, 0.8, 0.21);
  bodyGroup.add(beltBuckle);

  const beltNeon = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.12, 0.04, 0.02)),
    teamGlowMaterial,
  );
  beltNeon.position.set(0, 0.8, 0.245);
  bodyGroup.add(beltNeon);

  // 4. Sculpted Cyber-Mecha Torso with EQ Chest Screen & Harness Straps
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.85, 0);
  torsoGroup.rotation.y = -facingSign * 0.42;
  bodyGroup.add(torsoGroup);

  const torsoCore = new THREE.Mesh(
    track(createSculptedTorsoGeometry(style)),
    wetsuitMaterial,
  );
  torsoCore.castShadow = true;
  torsoGroup.add(torsoCore);

  // Broad weathered armored chest cuirass
  const cuirass = new THREE.Mesh(
    track(createChestCuirassGeometry(style)),
    armorMaterial,
  );
  cuirass.position.set(0, 0.45, 0.14);
  cuirass.castShadow = true;
  torsoGroup.add(cuirass);

  // Heavy twin dark over-the-shoulder harness straps + metallic clasp buckles (matching Image 2)
  for (const dir of [-1, 1] as const) {
    const strap = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.088, 0.44, 0.34)),
      darkAnodizedMaterial,
    );
    strap.position.set(dir * 0.22, 0.57, -0.01);
    strap.rotation.z = dir * 0.12;
    torsoGroup.add(strap);

    const clasp = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.1, 0.065, 0.05)),
      metalTrimMaterial,
    );
    clasp.position.set(dir * 0.21, 0.62, 0.19);
    torsoGroup.add(clasp);
  }

  // Prominent illuminated Wide Chest Equalizer & Cyber-Grid Panel
  const chestFrame = new THREE.Mesh(
    track(new THREE.BoxGeometry(style === "queen" ? 0.44 : 0.52, 0.27, 0.04)),
    darkAnodizedMaterial,
  );
  chestFrame.position.set(0, 0.44, 0.262);
  torsoGroup.add(chestFrame);

  const chestEqScreen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(style === "queen" ? 0.4 : 0.48, 0.23)),
    chestEqMaterial,
  );
  chestEqScreen.position.set(0, 0.44, 0.285);
  torsoGroup.add(chestEqScreen);

  // Heavy armored neck collar ring
  const collarRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.2, 0.05, 10, 24)),
    armorMaterial,
  );
  collarRing.rotation.x = Math.PI / 2 - 0.14;
  collarRing.position.set(0, 0.72, 0.01);
  torsoGroup.add(collarRing);

  // Armored Spine Reactor & Dual Hydro-Thruster Pack on back
  const soundPack = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.42, 0.48, 0.2)),
    armorMaterial,
  );
  soundPack.position.set(0, 0.43, -0.24);
  soundPack.castShadow = true;
  torsoGroup.add(soundPack);

  const packVent = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.3, 0.34, 0.06)),
    darkAnodizedMaterial,
  );
  packVent.position.set(0, 0.44, -0.33);
  torsoGroup.add(packVent);

  for (const dir of [-1, 1] as const) {
    const canister = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.065, 0.065, 0.38, 12)),
      metalTrimMaterial,
    );
    canister.position.set(dir * 0.16, 0.44, -0.34);
    torsoGroup.add(canister);

    const nozzle = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.048, 0.066, 0.08, 12)),
      teamGlowMaterial,
    );
    nozzle.position.set(dir * 0.16, 0.23, -0.34);
    torsoGroup.add(nozzle);
  }

  // 5. Heavy Cyber-Mecha Arms in Athletic Surf Crouch (Angled Down-Forward, Snug Pauldrons)
  const shoulderX = style === "queen" ? 0.39 : 0.44;
  const createArm = (sideDir: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(sideDir * shoulderX, 0.62, 0.02);

    // Massive layered Shoulder Pauldron shell hugging deltoid
    const pauldronDome = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68)),
      armorMaterial,
    );
    pauldronDome.scale.set(1.12, 0.98, 1.18);
    pauldronDome.rotation.z = -sideDir * 0.46;
    pauldronDome.castShadow = true;
    arm.add(pauldronDome);

    const pauldronRim = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.18, 0.018, 8, 24)),
      teamGlowMaterial,
    );
    pauldronRim.rotation.x = Math.PI / 2;
    pauldronRim.rotation.y = -sideDir * 0.46;
    pauldronRim.position.set(sideDir * 0.03, -0.02, 0);
    arm.add(pauldronRim);

    // Glowing 5-bar EQ Decal Panel facing camera cleanly on shoulder dome
    const shoulderEqBadge = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.155, 0.155)),
      shoulderEqMaterial,
    );
    shoulderEqBadge.position.set(sideDir * 0.185, 0.04, 0.08);
    shoulderEqBadge.rotation.y = sideDir * 0.92;
    shoulderEqBadge.rotation.x = -0.22;
    arm.add(shoulderEqBadge);

    // Upper arm angled naturally DOWN & out from shoulder
    const upperArmCore = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.1, 0.086, 0.31, 12)),
      wetsuitMaterial,
    );
    upperArmCore.position.set(sideDir * 0.1, -0.17, 0.02);
    upperArmCore.rotation.z = sideDir * 0.44;
    upperArmCore.rotation.x = -0.22;
    upperArmCore.castShadow = true;
    arm.add(upperArmCore);

    const elbowArmor = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.125, 0.125, 0.13)),
      darkAnodizedMaterial,
    );
    elbowArmor.position.set(sideDir * 0.18, -0.31, 0.06);
    arm.add(elbowArmor);

    // Forearm gauntlet bent forward for athletic wave-riding balance
    const forearm = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.112, 0.088, 0.32, 10)),
      armorMaterial,
    );
    forearm.position.set(sideDir * 0.22, -0.38, 0.2);
    forearm.rotation.x = -1.05;
    forearm.rotation.z = -sideDir * 0.22;
    forearm.castShadow = true;
    arm.add(forearm);

    const bracerGlow = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.032, 0.032, 0.22)),
      teamGlowMaterial,
    );
    bracerGlow.position.set(sideDir * 0.27, -0.36, 0.22);
    bracerGlow.rotation.x = 0.52;
    arm.add(bracerGlow);

    const wristRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.084, 0.018, 8, 16)),
      teamGlowMaterial,
    );
    wristRing.position.set(sideDir * 0.25, -0.44, 0.34);
    wristRing.rotation.x = 0.52;
    arm.add(wristRing);

    const mechGlove = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.135, 0.115, 0.145)),
      darkAnodizedMaterial,
    );
    mechGlove.position.set(sideDir * 0.26, -0.46, 0.39);
    mechGlove.rotation.x = 0.4;
    arm.add(mechGlove);

    return arm;
  };

  const leftArmGroup = createArm(-1);
  const rightArmGroup = createArm(1);
  torsoGroup.add(leftArmGroup, rightArmGroup);

  // 6. Armored Cyber Helmet + Matte OLED Album Artwork Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.03, 0.04);
  torsoGroup.add(headGroup);

  const neckConduit = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.13, 0.155, 0.2, 14)),
    wetsuitMaterial,
  );
  neckConduit.position.set(0, -0.25, -0.02);
  headGroup.add(neckConduit);

  const helmetShell = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.4, 24, 18)),
    armorMaterial,
  );
  // Keep helmet shell front apex (z <= +0.187) strictly behind the flat OLED visor stack (z >= +0.236)
  helmetShell.scale.set(1.06, 1.05, 0.68);
  helmetShell.position.z = -0.085;
  helmetShell.castShadow = true;
  headGroup.add(helmetShell);

  // Heavy jaw & cheek intake guards framing the visor
  for (const dir of [-1, 1] as const) {
    const cheekGuard = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.13, 0.22, 0.24)),
      darkAnodizedMaterial,
    );
    cheekGuard.position.set(dir * 0.34, -0.1, 0.08);
    cheekGuard.rotation.y = dir * 0.44;
    headGroup.add(cheekGuard);
  }

  // Brow helmet cowl overhang
  const browCowl = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.44, 0.085, 0.16)),
    armorMaterial,
  );
  browCowl.position.set(0, 0.365, 0.16);
  browCowl.rotation.x = 0.25;
  headGroup.add(browCowl);

  // Heavy anodized outer visor bezel + glowing perimeter LED ring
  const outerHousingRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.36, 0.048, 12, 36)),
    darkAnodizedMaterial,
  );
  outerHousingRing.position.set(0, 0, 0.228);
  headGroup.add(outerHousingRing);

  const bezelRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.338, 0.022, 10, 36)),
    teamGlowMaterial,
  );
  bezelRing.position.set(0, 0, 0.248);
  headGroup.add(bezelRing);

  const screenBack = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.336, 36)),
    track(new THREE.MeshBasicMaterial({ color: 0x050914 })),
  );
  screenBack.position.set(0, 0, 0.236);
  headGroup.add(screenBack);

  // Glare-free matte OLED Album Art Visor (completely clear of helmetShell)
  visorMaterial.roughness = 0.94;
  visorMaterial.metalness = 0.0;
  visorMaterial.envMapIntensity = 0.0;
  const visorMesh = new THREE.Mesh(track(new THREE.CircleGeometry(0.328, 36)), visorMaterial);
  visorMesh.position.set(0, 0, 0.256);
  headGroup.add(visorMesh);

  // Subtle integrated acoustic ear hubs even at Lv.1
  for (const dir of [-1, 1] as const) {
    const baseEarPod = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14)),
      darkAnodizedMaterial,
    );
    baseEarPod.rotation.z = Math.PI / 2;
    baseEarPod.position.set(dir * 0.4, 0, 0.02);
    headGroup.add(baseEarPod);
  }

  // Style-specific helmet crests
  const proCrestGroup = new THREE.Group();
  const finCrest = new THREE.Mesh(
    track(createWingGeometry(0.26, 0.2, 0.3)),
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
      track(createWingGeometry(0.36, 0.32, 0.17)),
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

  // 7. Progressive Level 2-5 Cyber Wearables
  // 7a. Level 2: Chunky Over-Ear Cyber DJ Headphones with Glowing Waveform Ear Cups
  const headphonesGroup = new THREE.Group();
  const headband = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.46, 0.044, 12, 32, Math.PI * 1.08)),
    darkAnodizedMaterial,
  );
  headband.rotation.z = -Math.PI * 0.04;
  headphonesGroup.add(headband);
  for (const dir of [-1, 1] as const) {
    const cushion = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.16, 0.048, 10, 20)),
      wetsuitMaterial,
    );
    cushion.rotation.y = Math.PI / 2;
    cushion.position.set(dir * 0.42, 0, 0.02);
    headphonesGroup.add(cushion);

    const cup = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.175, 0.165, 0.095, 18)),
      armorMaterial,
    );
    cup.rotation.z = Math.PI / 2;
    cup.position.set(dir * 0.46, 0, 0.02);
    headphonesGroup.add(cup);

    const cupGlow = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.145, 0.022, 8, 24)),
      teamGlowMaterial,
    );
    cupGlow.rotation.y = Math.PI / 2;
    cupGlow.position.set(dir * 0.512, 0, 0.02);
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
    cupInnerWave.position.set(dir * 0.514, 0, 0.02);
    headphonesGroup.add(cupInnerWave);
  }
  headphonesGroup.scale.setScalar(0.0001);
  headphonesGroup.visible = false;
  headGroup.add(headphonesGroup);

  // 7b. Level 3: Iridescent Prism Brow Shades
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
  shadesMesh.position.set(0, 0.325, 0.268);
  shadesGroup.add(shadesMesh);
  shadesGroup.scale.setScalar(0.0001);
  shadesGroup.visible = false;
  headGroup.add(shadesGroup);

  // 7c. Level 3: Carbon Board Hydro-Wings
  const hydroWingsGroup = new THREE.Group();
  const hydroWingGeo = track(createWingGeometry(0.48, 0.28, 0.36));
  for (const dir of [-1, 1] as const) {
    const wing = new THREE.Mesh(hydroWingGeo, armorMaterial);
    wing.rotation.x = -Math.PI / 2;
    wing.position.set(dir * 0.38, 0.05, -0.35);
    wing.scale.x = dir;
    hydroWingsGroup.add(wing);

    const wingEdge = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.44, 0.024, 0.04)),
      teamGlowMaterial,
    );
    wingEdge.position.set(dir * 0.62, 0.065, -0.36);
    wingEdge.rotation.y = -dir * 0.45;
    hydroWingsGroup.add(wingEdge);
  }
  hydroWingsGroup.scale.setScalar(0.0001);
  hydroWingsGroup.visible = false;
  boardGroup.add(hydroWingsGroup);

  // 7d. Level 4: EQ Halo Crown
  const soundCrownGroup = new THREE.Group();
  soundCrownGroup.position.set(0, 0.52, 0.02);
  const crownRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.29, 0.024, 12, 32)),
    goldMaterial,
  );
  crownRing.rotation.x = Math.PI / 2;
  soundCrownGroup.add(crownRing);

  const crownProngs: THREE.Mesh[] = [];
  const prongGeo = track(new THREE.CylinderGeometry(0.015, 0.032, 0.2, 8));
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const prong = new THREE.Mesh(prongGeo, i % 2 === 0 ? goldMaterial : teamGlowMaterial);
    prong.position.set(Math.cos(angle) * 0.29, 0.1, Math.sin(angle) * 0.29);
    soundCrownGroup.add(prong);
    crownProngs.push(prong);
  }
  soundCrownGroup.scale.setScalar(0.0001);
  soundCrownGroup.visible = false;
  headGroup.add(soundCrownGroup);

  // 7e. Level 5: Translucent Crystalline Energy Wings + Holographic Waveform Burst (Image 2)
  const reverbCapeGroup = new THREE.Group();
  reverbCapeGroup.position.set(0, 0.68, -0.24);

  const bladeTopGeo = track(createCrystalWingBladeGeometry(1.45, 1.34, 0.36));
  const bladeMidGeo = track(createCrystalWingBladeGeometry(1.54, 0.84, 0.32));
  const bladeLowGeo = track(createCrystalWingBladeGeometry(1.26, 0.36, 0.26));

  const crystalWingMat = track(
    new THREE.MeshPhysicalMaterial({
      color: palette.primary,
      emissive: palette.primary,
      emissiveIntensity: 0.85,
      roughness: 0.06,
      metalness: 0.12,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const waveformRibbonMat = track(
    new THREE.MeshBasicMaterial({
      map: decals.waveformMap,
      color: 0xdff8ff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const wingMeshes: THREE.Mesh[] = [];
  for (const dir of [-1, 1] as const) {
    const topVane = new THREE.Mesh(bladeTopGeo, crystalWingMat);
    topVane.position.set(dir * 0.16, 0.22, -0.02);
    topVane.rotation.y = -dir * 0.14;
    topVane.scale.x = dir;
    reverbCapeGroup.add(topVane);
    wingMeshes.push(topVane);

    const midVane = new THREE.Mesh(bladeMidGeo, crystalWingMat);
    midVane.position.set(dir * 0.18, 0.06, -0.04);
    midVane.rotation.y = -dir * 0.18;
    midVane.scale.x = dir;
    reverbCapeGroup.add(midVane);
    wingMeshes.push(midVane);

    const lowVane = new THREE.Mesh(bladeLowGeo, crystalWingMat);
    lowVane.position.set(dir * 0.16, -0.08, -0.06);
    lowVane.rotation.y = -dir * 0.22;
    lowVane.scale.x = dir;
    reverbCapeGroup.add(lowVane);
    wingMeshes.push(lowVane);

    // Glowing holographic audio-waveform ribbon projecting across each crystal wing
    const waveBurst = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.36, 0.66)),
      waveformRibbonMat,
    );
    waveBurst.position.set(dir * 0.82, 0.44, 0.04);
    waveBurst.rotation.y = -dir * 0.12;
    waveBurst.rotation.z = dir * 0.26;
    reverbCapeGroup.add(waveBurst);
  }

  reverbCapeGroup.scale.setScalar(0.0001);
  reverbCapeGroup.visible = false;
  torsoGroup.add(reverbCapeGroup);

  const wearables: Record<WearableId, WearableRig> = {
    headphones: { group: headphonesGroup, currentScale: 0, targetActive: false },
    shades: { group: shadesGroup, currentScale: 0, targetActive: false },
    hydroWings: { group: hydroWingsGroup, currentScale: 0, targetActive: false },
    soundCrown: { group: soundCrownGroup, currentScale: 0, targetActive: false, crownProngs },
    reverbCape: { group: reverbCapeGroup, currentScale: 0, targetActive: false, wingMeshes },
  };

  const rig: SurferRig = {
    side,
    style,
    root,
    boardGroup,
    bodyGroup,
    torsoGroup,
    headGroup,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
    contactShadow,
    visorMesh,
    visorMaterial,
    teamGlowMaterial,
    wetsuitMaterial,
    armorMaterial,
    queenCrestGroup,
    proCrestGroup,
    wearables,
    currentTexture: null,
    flipX: false,
    disposables,
  };

  if (initialAlbumSource) {
    updateSurferAlbumTexture(rig, initialAlbumSource, false, maxAnisotropy);
  }

  return rig;
}

export function setSurferStyle(rig: SurferRig, style: SurferStyle): void {
  rig.style = style;
  rig.proCrestGroup.visible = style === "pro";
  rig.queenCrestGroup.visible = style === "queen";
}

function applyLoadedTexture(
  rig: SurferRig,
  tex: THREE.Texture,
  maxAnisotropy: number,
): void {
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
  rig.visorMaterial.emissiveIntensity = 0.58;
  rig.visorMaterial.map = tex;
  rig.visorMaterial.emissiveMap = tex;
  rig.visorMaterial.needsUpdate = true;
  if (prev && prev !== tex) {
    prev.dispose();
  }
}

export function updateSurferAlbumTexture(
  rig: SurferRig,
  source: string | HTMLCanvasElement | null,
  flipX: boolean,
  maxAnisotropy: number,
): void {
  rig.flipX = flipX;
  if (!source) return;

  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(source);
    applyLoadedTexture(rig, tex, maxAnisotropy);
    return;
  }

  if (typeof source !== "string" || typeof Image === "undefined") return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const tex = new THREE.Texture(img);
    applyLoadedTexture(rig, tex, maxAnisotropy);
  };
  img.src = source;
}

export function setSurferFlip(rig: SurferRig, flipX: boolean): void {
  rig.flipX = flipX;
  if (rig.currentTexture) {
    rig.currentTexture.center.set(0.5, 0.5);
    rig.currentTexture.repeat.x = flipX ? -1 : 1;
    rig.currentTexture.needsUpdate = true;
  }
}

export function disposeSurferRig(rig: SurferRig): void {
  if (rig.currentTexture) {
    rig.currentTexture.dispose();
    rig.currentTexture = null;
  }
  for (const item of rig.disposables) {
    item.dispose();
  }
}
