import * as THREE from "three";
import {
  type Side,
  type SurferStyle,
  type WearableId,
} from "@/lib/games/battle-logic";

export interface DancerRigParts {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  visorDisc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  visorBezel: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  torsoMesh: THREE.Mesh;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  comicBubbleGroup: THREE.Group;
  comicBubbleMat: THREE.MeshBasicMaterial;
  tier2Headphones: THREE.Group;
  tier3ShadesAndBoombox: THREE.Group;
  tier4GraffitiCrown: THREE.Group;
  tier5LedPufferAndAura: THREE.Group;
}

export interface DancerRigInstance {
  side: Side;
  style: SurferStyle;
  parts: DancerRigParts;
  albumTexture: THREE.Texture | null;
  baseColor: THREE.Color;
  accentColor: THREE.Color;
}

export function createDancerRig(
  side: Side,
  style: SurferStyle,
  albumSource: string | HTMLCanvasElement,
): DancerRigInstance {
  const root = new THREE.Group();
  root.name = `dancer-toy-${side}`;

  const isA = side === "A";
  // Brutalist pop-art color blocking: high-voltage cyan / electric lime with stark charcoal vinyl
  const baseColor = isA ? new THREE.Color("#0d2847") : new THREE.Color("#0d381e");
  const accentColor = isA ? new THREE.Color("#7ec1fb") : new THREE.Color("#95fe7c");
  const coreAccentHex = isA ? 0x7ec1fb : 0x95fe7c;
  const secondaryHex = isA ? 0xf2a74b : 0xe5c25a; // Magenta / Pop Yellow comic clash

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // High-gloss collectible vinyl toy material with stark pop-art comic edge
  const vinylMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.18,
    metalness: 0.15,
  });

  const accentVinylMat = new THREE.MeshStandardMaterial({
    color: coreAccentHex,
    roughness: 0.22,
    metalness: 0.2,
    emissive: coreAccentHex,
    emissiveIntensity: 0.35,
  });

  const sneakerMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.35,
    metalness: 0.1,
  });

  // 1. Torso: Oversized brutalist streetwear hoodie/block
  const torsoGeom = new THREE.CylinderGeometry(0.55, 0.48, 1.1, 8);
  torsoGeom.scale(1.15, 1.0, 0.85);
  const torsoMesh = new THREE.Mesh(torsoGeom, vinylMat);
  torsoMesh.position.set(0, 1.45, 0);
  torsoMesh.castShadow = true;
  bodyGroup.add(torsoMesh);

  // Chest Graphic Stripe / Pop Art Equalizer Decal
  const stripeGeom = new THREE.BoxGeometry(0.72, 0.28, 0.12);
  const stripeMesh = new THREE.Mesh(stripeGeom, accentVinylMat);
  stripeMesh.position.set(0, 1.5, 0.44);
  bodyGroup.add(stripeMesh);

  // 2. Head Group with Oversized Circular Album Face Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.35, 0);
  bodyGroup.add(headGroup);

  // Chunky stylized designer vinyl head sphere/cube
  const headGeom = new THREE.SphereGeometry(0.72, 16, 16);
  headGeom.scale(1.08, 0.98, 0.92);
  const headMesh = new THREE.Mesh(headGeom, vinylMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Visor Bezel (Chunky comic-line frame)
  const bezelGeom = new THREE.TorusGeometry(0.68, 0.08, 12, 32);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: coreAccentHex,
    emissive: coreAccentHex,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.3,
  });
  const visorBezel = new THREE.Mesh(bezelGeom, bezelMat);
  visorBezel.position.set(0, 0.04, 0.64);
  headGroup.add(visorBezel);

  // Oversized Circular Album Face Visor (Facing camera directly, flat & glare-free)
  const visorGeom = new THREE.CircleGeometry(0.66, 32);
  const visorMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const visorDisc = new THREE.Mesh(visorGeom, visorMat);
  visorDisc.position.set(0, 0.04, 0.66);
  headGroup.add(visorDisc);

  // 3. Limbs: Stylized Ball Joints + Oversized Cartoon Vinyl Hands
  // Left Arm
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.75, 1.85, 0);
  const armGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.75, 8);
  armGeom.translate(0, -0.35, 0);
  const leftArmMesh = new THREE.Mesh(armGeom, vinylMat);
  leftArmGroup.add(leftArmMesh);

  // Left Glove / Hand (Chunky stylized vinyl fist)
  const handGeom = new THREE.SphereGeometry(0.24, 12, 12);
  handGeom.scale(1.1, 1.1, 1.2);
  const leftHandMesh = new THREE.Mesh(handGeom, accentVinylMat);
  leftHandMesh.position.set(0, -0.72, 0);
  leftArmGroup.add(leftHandMesh);
  bodyGroup.add(leftArmGroup);

  // Right Arm
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.75, 1.85, 0);
  const rightArmMesh = new THREE.Mesh(armGeom, vinylMat);
  rightArmGroup.add(rightArmMesh);

  const rightHandMesh = new THREE.Mesh(handGeom, accentVinylMat);
  rightHandMesh.position.set(0, -0.72, 0);
  rightArmGroup.add(rightHandMesh);
  bodyGroup.add(rightArmGroup);

  // 4. Legs & Chunky Streetwear Kicks
  // Left Leg
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.35, 0.95, 0);
  const legGeom = new THREE.CylinderGeometry(0.22, 0.24, 0.65, 8);
  legGeom.translate(0, -0.3, 0);
  const leftLegMesh = new THREE.Mesh(legGeom, vinylMat);
  leftLegGroup.add(leftLegMesh);

  // Left Sneaker (Chunky high-top sneaker sole)
  const sneakerGeom = new THREE.BoxGeometry(0.38, 0.32, 0.78);
  sneakerGeom.translate(0, -0.68, 0.12);
  const leftSneaker = new THREE.Mesh(sneakerGeom, sneakerMat);
  leftLegGroup.add(leftSneaker);
  // Sneaker sole stripe
  const soleGeom = new THREE.BoxGeometry(0.4, 0.08, 0.8);
  soleGeom.translate(0, -0.8, 0.12);
  const leftSole = new THREE.Mesh(soleGeom, accentVinylMat);
  leftLegGroup.add(leftSole);
  bodyGroup.add(leftLegGroup);

  // Right Leg
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.35, 0.95, 0);
  const rightLegMesh = new THREE.Mesh(legGeom, vinylMat);
  rightLegGroup.add(rightLegMesh);

  const rightSneaker = new THREE.Mesh(sneakerGeom, sneakerMat);
  rightLegGroup.add(rightSneaker);
  const rightSole = new THREE.Mesh(soleGeom, accentVinylMat);
  rightLegGroup.add(rightSole);
  bodyGroup.add(rightLegGroup);

  // 5. Comic Pop-Art Callout Burst Bubble ("GROOVE!", "POW!", "BOOM!")
  const comicBubbleGroup = new THREE.Group();
  comicBubbleGroup.position.set(0, 3.4, 0);
  comicBubbleGroup.visible = false;
  root.add(comicBubbleGroup);

  // Procedural canvas pop-art burst texture
  const comicCanvas = document.createElement("canvas");
  comicCanvas.width = 256;
  comicCanvas.height = 128;
  const cCtx = comicCanvas.getContext("2d");
  if (cCtx) {
    // Starburst comic burst background
    cCtx.fillStyle = secondaryHex === 0xf2a74b ? "#f2a74b" : "#e5c25a";
    cCtx.beginPath();
    const cx = 128;
    const cy = 64;
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      const r = i % 2 === 0 ? 56 : 32;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) cCtx.moveTo(x, y);
      else cCtx.lineTo(x, y);
    }
    cCtx.closePath();
    cCtx.fill();
    cCtx.lineWidth = 4;
    cCtx.strokeStyle = "#000000";
    cCtx.stroke();

    // Bold comic text
    cCtx.font = "900 24px 'Space Grotesk', 'Arial Black', sans-serif";
    cCtx.fillStyle = "#ffffff";
    cCtx.textAlign = "center";
    cCtx.textBaseline = "middle";
    cCtx.lineWidth = 4;
    cCtx.strokeText("GROOVE!", cx, cy);
    cCtx.fillText("GROOVE!", cx, cy);
  }
  const comicTex = new THREE.CanvasTexture(comicCanvas);
  comicTex.needsUpdate = true;
  const comicBubbleMat = new THREE.MeshBasicMaterial({
    map: comicTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const bubbleGeom = new THREE.PlaneGeometry(1.8, 0.9);
  const bubbleMesh = new THREE.Mesh(bubbleGeom, comicBubbleMat);
  comicBubbleGroup.add(bubbleMesh);

  // 6. Upgrades — LV.2: Chunky Street Headphones
  const tier2Headphones = new THREE.Group();
  tier2Headphones.visible = false;
  const phoneBandGeom = new THREE.TorusGeometry(0.74, 0.08, 8, 24, Math.PI);
  phoneBandGeom.rotateZ(Math.PI);
  const phoneBand = new THREE.Mesh(phoneBandGeom, accentVinylMat);
  phoneBand.position.set(0, 0.05, 0);
  tier2Headphones.add(phoneBand);

  const phoneEarGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.18, 16);
  phoneEarGeom.rotateZ(Math.PI / 2);
  const phoneEarL = new THREE.Mesh(phoneEarGeom, accentVinylMat);
  phoneEarL.position.set(-0.76, 0.05, 0);
  tier2Headphones.add(phoneEarL);
  const phoneEarR = new THREE.Mesh(phoneEarGeom, accentVinylMat);
  phoneEarR.position.set(0.76, 0.05, 0);
  tier2Headphones.add(phoneEarR);
  headGroup.add(tier2Headphones);

  // 7. Upgrades — LV.3: Pop-Art Shutter Shades + Boombox Boom-Pack
  const tier3ShadesAndBoombox = new THREE.Group();
  tier3ShadesAndBoombox.visible = false;

  // Pop-Art Shutter Shades over visor
  const shadesGeom = new THREE.BoxGeometry(1.15, 0.22, 0.12);
  const shadesMat = new THREE.MeshStandardMaterial({
    color: 0xf2a74b,
    metalness: 0.6,
    roughness: 0.2,
    emissive: 0xf2a74b,
    emissiveIntensity: 0.4,
  });
  const shadesMesh = new THREE.Mesh(shadesGeom, shadesMat);
  shadesMesh.position.set(0, 0.08, 0.72);
  tier3ShadesAndBoombox.add(shadesMesh);

  // Boombox Boom-Pack mounted on back
  const packGeom = new THREE.BoxGeometry(0.9, 0.55, 0.35);
  const packMesh = new THREE.Mesh(packGeom, accentVinylMat);
  packMesh.position.set(0, -0.85, -0.52);
  tier3ShadesAndBoombox.add(packMesh);
  headGroup.add(tier3ShadesAndBoombox);

  // 8. Upgrades — LV.4: Graffiti Halo Crown
  const tier4GraffitiCrown = new THREE.Group();
  tier4GraffitiCrown.visible = false;
  const crownGeom = new THREE.TorusGeometry(0.55, 0.05, 6, 24);
  crownGeom.rotateX(Math.PI / 2);
  const crownMat = new THREE.MeshBasicMaterial({
    color: 0xe5c25a,
  });
  const crownRing = new THREE.Mesh(crownGeom, crownMat);
  crownRing.position.set(0, 0.85, 0);
  tier4GraffitiCrown.add(crownRing);

  // Pop-art crown spikes
  for (let s = 0; s < 5; s++) {
    const spikeGeom = new THREE.ConeGeometry(0.08, 0.28, 4);
    const spike = new THREE.Mesh(spikeGeom, crownMat);
    const angle = (s / 5) * Math.PI * 2;
    spike.position.set(Math.cos(angle) * 0.55, 0.98, Math.sin(angle) * 0.55);
    tier4GraffitiCrown.add(spike);
  }
  headGroup.add(tier4GraffitiCrown);

  // 9. Upgrades — LV.5: LED Puffer & Comic Aura Wings
  const tier5LedPufferAndAura = new THREE.Group();
  tier5LedPufferAndAura.visible = false;

  // Oversized Puffer Shoulder Flares
  const shoulderGeom = new THREE.SphereGeometry(0.35, 10, 10);
  shoulderGeom.scale(1.2, 0.8, 1.0);
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: coreAccentHex,
    emissive: coreAccentHex,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });
  const shoulderL = new THREE.Mesh(shoulderGeom, shoulderMat);
  shoulderL.position.set(-0.85, 1.85, 0);
  tier5LedPufferAndAura.add(shoulderL);
  const shoulderR = new THREE.Mesh(shoulderGeom, shoulderMat);
  shoulderR.position.set(0.85, 1.85, 0);
  tier5LedPufferAndAura.add(shoulderR);

  // Comic Action Aura Wing Planes
  const auraGeom = new THREE.BufferGeometry();
  const auraVerts = new Float32Array([
    0, 0, 0,
    1.2, 0.8, -0.2,
    0.6, -0.6, -0.1,
  ]);
  auraGeom.setAttribute("position", new THREE.BufferAttribute(auraVerts, 3));
  auraGeom.computeVertexNormals();
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xe5c25a,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const auraL = new THREE.Mesh(auraGeom, auraMat);
  auraL.position.set(-0.6, 1.6, -0.3);
  auraL.scale.set(-1, 1, 1);
  tier5LedPufferAndAura.add(auraL);

  const auraR = new THREE.Mesh(auraGeom, auraMat);
  auraR.position.set(0.6, 1.6, -0.3);
  tier5LedPufferAndAura.add(auraR);
  bodyGroup.add(tier5LedPufferAndAura);

  const parts: DancerRigParts = {
    root,
    bodyGroup,
    headGroup,
    visorDisc,
    visorBezel,
    torsoMesh,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
    comicBubbleGroup,
    comicBubbleMat,
    tier2Headphones,
    tier3ShadesAndBoombox,
    tier4GraffitiCrown,
    tier5LedPufferAndAura,
  };

  const instance: DancerRigInstance = {
    side,
    style,
    parts,
    albumTexture: null,
    baseColor,
    accentColor,
  };

  updateDancerAlbumTexture(instance, albumSource);
  setDancerStyle(instance, style);

  return instance;
}

export function updateDancerAlbumTexture(
  dancer: DancerRigInstance,
  source: string | HTMLCanvasElement,
): void {
  if (dancer.albumTexture) {
    dancer.albumTexture.dispose();
    dancer.albumTexture = null;
  }

  let tex: THREE.Texture;
  if (typeof source === "string") {
    const loader = new THREE.TextureLoader();
    tex = loader.load(source, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
    });
  } else {
    tex = new THREE.CanvasTexture(source);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }

  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;

  dancer.albumTexture = tex;
  dancer.parts.visorDisc.material.map = tex;
  dancer.parts.visorDisc.material.needsUpdate = true;
}

export function setDancerStyle(dancer: DancerRigInstance, style: SurferStyle): void {
  dancer.style = style;
  if (style === "queen") {
    dancer.parts.torsoMesh.scale.set(1.05, 1.0, 0.8);
  } else {
    dancer.parts.torsoMesh.scale.set(1.15, 1.0, 0.85);
  }
}

export function setDancerFlip(dancer: DancerRigInstance, flipX: boolean): void {
  if (dancer.albumTexture) {
    dancer.albumTexture.wrapS = THREE.RepeatWrapping;
    dancer.albumTexture.repeat.x = flipX ? -1 : 1;
    dancer.albumTexture.offset.x = flipX ? 1 : 0;
    dancer.albumTexture.needsUpdate = true;
  }
}

export function updateDancerTierWearables(
  dancer: DancerRigInstance,
  wearables: readonly WearableId[],
): void {
  dancer.parts.tier2Headphones.visible = wearables.includes("headphones");
  dancer.parts.tier3ShadesAndBoombox.visible =
    wearables.includes("shades") || wearables.includes("hydroWings");
  dancer.parts.tier4GraffitiCrown.visible = wearables.includes("soundCrown");
  dancer.parts.tier5LedPufferAndAura.visible = wearables.includes("reverbCape");
}

export function setComicBubbleText(
  dancer: DancerRigInstance,
  text: string,
  colorHex = "#ffffff",
  bgHex = "#e5c25a",
): void {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cx = 128;
  const cy = 64;
  // Dynamic comic burst star
  ctx.fillStyle = bgHex;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    const r = i % 2 === 0 ? 58 : 34;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.stroke();

  ctx.font = "900 24px 'Space Grotesk', 'Arial Black', sans-serif";
  ctx.fillStyle = colorHex;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(text, cx, cy);
  ctx.fillText(text, cx, cy);

  if (dancer.parts.comicBubbleMat.map) {
    dancer.parts.comicBubbleMat.map.dispose();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  dancer.parts.comicBubbleMat.map = tex;
  dancer.parts.comicBubbleMat.needsUpdate = true;
}

export function disposeDancerRig(dancer: DancerRigInstance): void {
  if (dancer.albumTexture) {
    dancer.albumTexture.dispose();
    dancer.albumTexture = null;
  }
  if (dancer.parts.comicBubbleMat.map) {
    dancer.parts.comicBubbleMat.map.dispose();
  }
  dancer.parts.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
  });
}
