import * as THREE from "three";
import {
  type Side,
  type SurferStyle,
  type WearableId,
  getSurferTier,
} from "@/lib/games/battle-logic";

export interface RacerPodParts {
  root: THREE.Group;
  chassis: THREE.Group;
  cockpitGroup: THREE.Group;
  visorDisc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  sideDecalL: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  sideDecalR: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  leftAirBrake: THREE.Group;
  rightAirBrake: THREE.Group;
  leftThrusterCone: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  rightThrusterCone: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  tier2HeadPods: THREE.Group;
  tier3Canards: THREE.Group;
  tier4HaloSpoiler: THREE.Group;
  tier5LaserWings: THREE.Group;
  repulsorGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}

export interface RacerPodInstance {
  side: Side;
  style: SurferStyle;
  parts: RacerPodParts;
  albumTexture: THREE.Texture | null;
  baseColor: THREE.Color;
  accentColor: THREE.Color;
}

const scratchVec = new THREE.Vector3();

export function createRacerPod(
  side: Side,
  style: SurferStyle,
  albumSource: string | HTMLCanvasElement,
): RacerPodInstance {
  const root = new THREE.Group();
  root.name = `racer-pod-${side}`;

  const isA = side === "A";
  const baseColor = isA ? new THREE.Color("#0a3866") : new THREE.Color("#0d4722");
  const accentColor = isA ? new THREE.Color("#7ec1fb") : new THREE.Color("#95fe7c");
  const coreAccentHex = isA ? 0x7ec1fb : 0x95fe7c;
  const secondaryColor = isA ? 0x38bdf8 : 0x4ade80;

  // Primary chassis group (handles local bank, pitch, roll)
  const chassis = new THREE.Group();
  root.add(chassis);

  // 1. Aerodynamic Sleek Fuselage Hull (wedge nose + tapered aft)
  const hullGeom = new THREE.CylinderGeometry(0.38, 0.72, 2.6, 8, 1);
  hullGeom.rotateX(Math.PI / 2);
  hullGeom.scale(1.15, 0.52, 1.0);
  const hullMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness: 0.82,
    roughness: 0.28,
  });
  const hullMesh = new THREE.Mesh(hullGeom, hullMat);
  hullMesh.position.set(0, 0.42, 0);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  chassis.add(hullMesh);

  // Hull Nose Cap (aerodynamic intake cone)
  const noseGeom = new THREE.ConeGeometry(0.44, 0.9, 8);
  noseGeom.rotateX(-Math.PI / 2);
  noseGeom.scale(1.1, 0.45, 1.0);
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0x141d2f,
    metalness: 0.9,
    roughness: 0.18,
  });
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.set(0, 0.42, -1.55);
  chassis.add(noseMesh);

  // Under-chassis anti-grav repulsor plate
  const keelGeom = new THREE.BoxGeometry(0.7, 0.12, 2.2);
  const keelMat = new THREE.MeshStandardMaterial({
    color: 0x070c16,
    metalness: 0.95,
    roughness: 0.2,
  });
  const keelMesh = new THREE.Mesh(keelGeom, keelMat);
  keelMesh.position.set(0, 0.18, 0);
  chassis.add(keelMesh);

  // Glowing ground repulsor aura plane
  const repulsorGeom = new THREE.PlaneGeometry(1.4, 2.8);
  repulsorGeom.rotateX(-Math.PI / 2);
  const repulsorMat = new THREE.MeshBasicMaterial({
    color: coreAccentHex,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const repulsorGlow = new THREE.Mesh(repulsorGeom, repulsorMat);
  repulsorGlow.position.set(0, 0.05, 0);
  chassis.add(repulsorGlow);

  // 2. Cockpit / Visor Group — prominent, camera-facing disc
  // Chase cam sits at (0, 2.05, 5.2) looking down at (0, 1.25, -6.0)
  // Tilting the visorMount back by ~74° (-Math.PI * 0.41) faces the chase camera directly!
  const cockpitGroup = new THREE.Group();
  cockpitGroup.position.set(0, 0.74, -0.28);
  chassis.add(cockpitGroup);

  const visorMount = new THREE.Group();
  visorMount.rotation.x = -Math.PI * 0.41;
  cockpitGroup.add(visorMount);

  // Bezel ring for the cockpit album visor
  const bezelGeom = new THREE.TorusGeometry(0.62, 0.05, 12, 36);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: coreAccentHex,
    emissive: coreAccentHex,
    emissiveIntensity: 0.65,
    metalness: 0.85,
    roughness: 0.15,
  });
  const bezelMesh = new THREE.Mesh(bezelGeom, bezelMat);
  visorMount.add(bezelMesh);

  // Flat, glare-free circular album art visor
  const visorGeom = new THREE.CircleGeometry(0.60, 36);
  const visorMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const visorDisc = new THREE.Mesh(visorGeom, visorMat);
  visorDisc.position.z = 0.035; // Guaranteed forward offset in visor plane
  visorMount.add(visorDisc);

  // Side Flank Turbine Decals (left & right)
  const sideDecalGeom = new THREE.CircleGeometry(0.30, 24);
  const sideDecalMatL = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false,
    toneMapped: false,
  });
  const sideDecalMatR = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false,
    toneMapped: false,
  });
  const sideDecalL = new THREE.Mesh(sideDecalGeom, sideDecalMatL);
  sideDecalL.position.set(-0.82, 0.44, 0.15);
  sideDecalL.rotation.y = -Math.PI / 2;
  chassis.add(sideDecalL);

  const sideDecalR = new THREE.Mesh(sideDecalGeom, sideDecalMatR);
  sideDecalR.position.set(0.82, 0.44, 0.15);
  sideDecalR.rotation.y = Math.PI / 2;
  chassis.add(sideDecalR);

  // 3. Side Nacelles / Anti-Grav Turbines
  const nacelleGeom = new THREE.CylinderGeometry(0.2, 0.26, 1.7, 8);
  nacelleGeom.rotateX(Math.PI / 2);
  const nacelleMat = new THREE.MeshStandardMaterial({
    color: 0x182438,
    metalness: 0.8,
    roughness: 0.3,
  });

  const nacelleL = new THREE.Mesh(nacelleGeom, nacelleMat);
  nacelleL.position.set(-0.72, 0.42, 0.15);
  chassis.add(nacelleL);

  const nacelleR = new THREE.Mesh(nacelleGeom, nacelleMat);
  nacelleR.position.set(0.72, 0.42, 0.15);
  chassis.add(nacelleR);

  // Nacelle Neon Glow Strips
  const stripGeom = new THREE.BoxGeometry(0.04, 0.04, 1.5);
  const stripMat = new THREE.MeshBasicMaterial({
    color: coreAccentHex,
  });
  const stripL = new THREE.Mesh(stripGeom, stripMat);
  stripL.position.set(-0.94, 0.42, 0.15);
  chassis.add(stripL);

  const stripR = new THREE.Mesh(stripGeom, stripMat);
  stripR.position.set(0.94, 0.42, 0.15);
  chassis.add(stripR);

  // 4. Twin Vectoring Jet Thruster Bells (aft propulsion)
  const bellGeom = new THREE.CylinderGeometry(0.24, 0.18, 0.45, 12);
  bellGeom.rotateX(Math.PI / 2);
  const bellMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.95,
    roughness: 0.15,
  });

  const bellL = new THREE.Mesh(bellGeom, bellMat);
  bellL.position.set(-0.34, 0.44, 1.45);
  chassis.add(bellL);

  const bellR = new THREE.Mesh(bellGeom, bellMat);
  bellR.position.set(0.34, 0.44, 1.45);
  chassis.add(bellR);

  // Thruster Plasma Flame Cones (outer glowing plume + inner bright core)
  const coneGeom = new THREE.ConeGeometry(0.20, 1.3, 12, 1, true);
  coneGeom.rotateX(Math.PI / 2);
  coneGeom.translate(0, 0, 0.65);
  const coneMatL = new THREE.MeshBasicMaterial({
    color: coreAccentHex,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coneMatR = coneMatL.clone();

  const leftThrusterCone = new THREE.Mesh(coneGeom, coneMatL);
  leftThrusterCone.position.set(-0.34, 0.44, 1.55);
  chassis.add(leftThrusterCone);

  const rightThrusterCone = new THREE.Mesh(coneGeom, coneMatR);
  rightThrusterCone.position.set(0.34, 0.44, 1.55);
  chassis.add(rightThrusterCone);

  const innerConeGeom = new THREE.ConeGeometry(0.08, 0.85, 8, 1, true);
  innerConeGeom.rotateX(Math.PI / 2);
  innerConeGeom.translate(0, 0, 0.42);
  const innerConeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerConeL = new THREE.Mesh(innerConeGeom, innerConeMat);
  leftThrusterCone.add(innerConeL);
  const innerConeR = new THREE.Mesh(innerConeGeom, innerConeMat);
  rightThrusterCone.add(innerConeR);

  // 5. Air-Brake Flaps (Left & Right)
  const brakeGeom = new THREE.BoxGeometry(0.32, 0.05, 0.45);
  brakeGeom.translate(0, 0, 0.22);
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x243247,
    metalness: 0.85,
    roughness: 0.25,
  });

  const leftAirBrake = new THREE.Group();
  leftAirBrake.position.set(-0.48, 0.62, 0.7);
  const lBrakeMesh = new THREE.Mesh(brakeGeom, brakeMat);
  leftAirBrake.add(lBrakeMesh);
  chassis.add(leftAirBrake);

  const rightAirBrake = new THREE.Group();
  rightAirBrake.position.set(0.48, 0.62, 0.7);
  const rBrakeMesh = new THREE.Mesh(brakeGeom, brakeMat);
  rightAirBrake.add(rBrakeMesh);
  chassis.add(rightAirBrake);

  // 6. Upgrades — LV.2: Aero Head-Pods (twin sensor pods mounted on canopy flanks)
  const tier2HeadPods = new THREE.Group();
  tier2HeadPods.visible = false;
  const podCylGeom = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8);
  podCylGeom.rotateX(Math.PI / 2);
  const podMat = new THREE.MeshStandardMaterial({
    color: coreAccentHex,
    metalness: 0.9,
    roughness: 0.2,
    emissive: coreAccentHex,
    emissiveIntensity: 0.35,
  });
  const podL = new THREE.Mesh(podCylGeom, podMat);
  podL.position.set(-0.52, 0.78, -0.15);
  tier2HeadPods.add(podL);
  const podR = new THREE.Mesh(podCylGeom, podMat);
  podR.position.set(0.52, 0.78, -0.15);
  tier2HeadPods.add(podR);
  chassis.add(tier2HeadPods);

  // 7. Upgrades — LV.3: Sonic Canard Winglets + Prism Windscreen
  const tier3Canards = new THREE.Group();
  tier3Canards.visible = false;
  const canardGeom = new THREE.BufferGeometry();
  // Swept canard wing triangle
  const canardVerts = new Float32Array([
    0, 0, -0.3,
    0.75, 0, 0.35,
    0, 0, 0.35,
  ]);
  canardGeom.setAttribute("position", new THREE.BufferAttribute(canardVerts, 3));
  canardGeom.computeVertexNormals();
  const canardMat = new THREE.MeshStandardMaterial({
    color: coreAccentHex,
    metalness: 0.95,
    roughness: 0.15,
    side: THREE.DoubleSide,
    emissive: coreAccentHex,
    emissiveIntensity: 0.4,
  });
  const canardL = new THREE.Mesh(canardGeom, canardMat);
  canardL.position.set(-0.55, 0.44, -0.65);
  canardL.scale.set(-1, 1, 1);
  tier3Canards.add(canardL);

  const canardR = new THREE.Mesh(canardGeom, canardMat);
  canardR.position.set(0.55, 0.44, -0.65);
  tier3Canards.add(canardR);
  chassis.add(tier3Canards);

  // 8. Upgrades — LV.4: Overdrive Halo Rear Spoiler
  const tier4HaloSpoiler = new THREE.Group();
  tier4HaloSpoiler.visible = false;
  const haloGeom = new THREE.TorusGeometry(0.55, 0.045, 8, 24);
  haloGeom.rotateX(Math.PI / 2);
  const haloMat = new THREE.MeshBasicMaterial({
    color: coreAccentHex,
  });
  const haloMesh = new THREE.Mesh(haloGeom, haloMat);
  haloMesh.position.set(0, 0.95, 1.25);
  tier4HaloSpoiler.add(haloMesh);

  // Spoiler struts
  const strutGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6);
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.9,
    roughness: 0.2,
  });
  const strutL = new THREE.Mesh(strutGeom, strutMat);
  strutL.position.set(-0.32, 0.75, 1.25);
  tier4HaloSpoiler.add(strutL);
  const strutR = new THREE.Mesh(strutGeom, strutMat);
  strutR.position.set(0.32, 0.75, 1.25);
  tier4HaloSpoiler.add(strutR);
  chassis.add(tier4HaloSpoiler);

  // 9. Upgrades — LV.5: Extended Overdrive Laser Wings
  const tier5LaserWings = new THREE.Group();
  tier5LaserWings.visible = false;
  const wingGeom = new THREE.BufferGeometry();
  const wingVerts = new Float32Array([
    0, 0, -0.6,
    1.65, 0.15, 0.75,
    0, 0, 0.5,
  ]);
  wingGeom.setAttribute("position", new THREE.BufferAttribute(wingVerts, 3));
  wingGeom.computeVertexNormals();
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wingL = new THREE.Mesh(wingGeom, wingMat);
  wingL.position.set(-0.7, 0.46, 0.35);
  wingL.scale.set(-1, 1, 1);
  tier5LaserWings.add(wingL);

  const wingR = new THREE.Mesh(wingGeom, wingMat);
  wingR.position.set(0.7, 0.46, 0.35);
  tier5LaserWings.add(wingR);
  chassis.add(tier5LaserWings);

  const parts: RacerPodParts = {
    root,
    chassis,
    cockpitGroup,
    visorDisc,
    sideDecalL,
    sideDecalR,
    leftAirBrake,
    rightAirBrake,
    leftThrusterCone,
    rightThrusterCone,
    tier2HeadPods,
    tier3Canards,
    tier4HaloSpoiler,
    tier5LaserWings,
    repulsorGlow,
  };

  const instance: RacerPodInstance = {
    side,
    style,
    parts,
    albumTexture: null,
    baseColor,
    accentColor,
  };

  updateRacerAlbumTexture(instance, albumSource);
  setRacerStyle(instance, style);

  return instance;
}

export function updateRacerAlbumTexture(
  racer: RacerPodInstance,
  source: string | HTMLCanvasElement,
): void {
  if (racer.albumTexture) {
    racer.albumTexture.dispose();
    racer.albumTexture = null;
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

  racer.albumTexture = tex;
  racer.parts.visorDisc.material.map = tex;
  racer.parts.visorDisc.material.needsUpdate = true;
  racer.parts.sideDecalL.material.map = tex;
  racer.parts.sideDecalL.material.needsUpdate = true;
  racer.parts.sideDecalR.material.map = tex;
  racer.parts.sideDecalR.material.needsUpdate = true;
}

export function setRacerStyle(racer: RacerPodInstance, style: SurferStyle): void {
  racer.style = style;
  // Queen style gives sleeker swept forward nose accents and brighter saturated canopy
  if (style === "queen") {
    racer.parts.chassis.scale.set(0.96, 0.98, 1.05);
  } else {
    racer.parts.chassis.scale.set(1.0, 1.0, 1.0);
  }
}

export function setRacerFlip(racer: RacerPodInstance, flipX: boolean): void {
  if (racer.albumTexture) {
    racer.albumTexture.wrapS = THREE.RepeatWrapping;
    racer.albumTexture.repeat.x = flipX ? -1 : 1;
    racer.albumTexture.offset.x = flipX ? 1 : 0;
    racer.albumTexture.needsUpdate = true;
  }
}

export function updateRacerTierWearables(
  racer: RacerPodInstance,
  wearables: readonly WearableId[],
): void {
  racer.parts.tier2HeadPods.visible = wearables.includes("headphones");
  racer.parts.tier3Canards.visible =
    wearables.includes("shades") || wearables.includes("hydroWings");
  racer.parts.tier4HaloSpoiler.visible = wearables.includes("soundCrown");
  racer.parts.tier5LaserWings.visible = wearables.includes("reverbCape");
}

export function disposeRacerPod(racer: RacerPodInstance): void {
  if (racer.albumTexture) {
    racer.albumTexture.dispose();
    racer.albumTexture = null;
  }
  racer.parts.root.traverse((obj) => {
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
