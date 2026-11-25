import * as THREE from "three";
import type { Side } from "@/lib/games/battle-logic";

export interface SceneTexturePack {
  neopreneBump: THREE.CanvasTexture;
  lunarRegolithBump: THREE.CanvasTexture;
  armorAlbedo: THREE.CanvasTexture;
  armorBump: THREE.CanvasTexture;
  earthGlobeMap: THREE.CanvasTexture;
  oceanDetail: THREE.CanvasTexture;
  dispose: () => void;
}

export interface SideDecalPack {
  eqChestMap: THREE.CanvasTexture;
  eqShoulderMap: THREE.CanvasTexture;
  boardGridMap: THREE.CanvasTexture;
  waveformMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(
  w: number,
  h: number = w,
): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext("2d")];
}

function hash2d(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Tileable hexagonal/ribbed carbon wetsuit weave for undersuit joints and conduits.
 */
function buildNeopreneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  if (ctx) {
    ctx.fillStyle = "#5c5c5c";
    ctx.fillRect(0, 0, size, size);

    // Ribbed cyber conduit horizontal bands + micro hex mesh
    for (let y = 0; y < size; y += 16) {
      const grad = ctx.createLinearGradient(0, y, 0, y + 16);
      grad.addColorStop(0, "#383838");
      grad.addColorStop(0.5, "#b8b8b8");
      grad.addColorStop(1, "#383838");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, size, 16);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.32)";
    ctx.lineWidth = 1.2;
    for (let i = -size; i < size * 2; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tileable cratered lunar regolith dust & rocky impact pockmarks (bump + roughness).
 */
function buildLunarRegolithTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const dust =
          Math.sin(u * Math.PI * 8 + Math.cos(v * Math.PI * 6) * 1.1) * 0.24 +
          Math.cos(v * Math.PI * 12 - Math.sin(u * Math.PI * 10)) * 0.18;
        const fine = (hash2d(x, y) - 0.5) * 0.34;
        const val = Math.max(0, Math.min(255, Math.round((0.40 + dust + fine) * 255)));
        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Stamp deep multi-scale lunar micro-craters with sunlit silver rims
    for (let i = 0; i < 48; i++) {
      const cx = hash2d(i * 4.3, 1.7) * size;
      const cy = hash2d(9.1, i * 6.7) * size;
      const r = 4 + hash2d(i * 2.1, i * 5.3) * 18;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = cx + ox;
          const py = cy + oy;
          if (px < -r || px > size + r || py < -r || py > size + r) continue;
          const grad = ctx.createRadialGradient(px, py, r * 0.1, px, py, r);
          grad.addColorStop(0, "rgba(18,22,28,0.88)");
          grad.addColorStop(0.65, "rgba(38,44,54,0.62)");
          grad.addColorStop(0.86, "rgba(210,220,232,0.58)");
          grad.addColorStop(1, "rgba(96,104,116,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 5);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Weathered brushed metallic cyber-armor texture pair (albedo + bump/roughness) with panel seams & scuffs.
 */
function buildCyberArmorTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 256;
  const [albCanvas, albCtx] = makeCanvas(size);
  const [bumpCanvas, bumpCtx] = makeCanvas(size);

  if (albCtx && bumpCtx) {
    // Base brushed steel patina
    albCtx.fillStyle = "#b8c7d9";
    albCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = "#989898";
    bumpCtx.fillRect(0, 0, size, size);

    // Subtle brushed directional streaks & battle wear blotches
    for (let i = 0; i < 190; i++) {
      const y = hash2d(i * 1.9, 3.1) * size;
      const x = hash2d(7.7, i * 2.3) * size;
      const len = 14 + hash2d(i, 9.2) * 52;
      const bright = hash2d(i * 5.1, 2.7) > 0.45;
      albCtx.strokeStyle = bright ? "rgba(240,250,255,0.18)" : "rgba(24,36,52,0.24)";
      albCtx.lineWidth = 1 + hash2d(i, 4.4) * 1.5;
      albCtx.beginPath();
      albCtx.moveTo(x, y);
      albCtx.lineTo(x + len, y + (hash2d(i, 8.1) - 0.5) * 6);
      albCtx.stroke();

      bumpCtx.strokeStyle = bright ? "rgba(220,220,220,0.22)" : "rgba(45,45,45,0.32)";
      bumpCtx.lineWidth = albCtx.lineWidth;
      bumpCtx.beginPath();
      bumpCtx.moveTo(x, y);
      bumpCtx.lineTo(x + len, y + (hash2d(i, 8.1) - 0.5) * 6);
      bumpCtx.stroke();
    }

    // Precision armored panel seams + rivets
    const drawSeam = (x1: number, y1: number, x2: number, y2: number) => {
      albCtx.strokeStyle = "rgba(18,26,38,0.68)";
      albCtx.lineWidth = 2.5;
      albCtx.beginPath();
      albCtx.moveTo(x1, y1);
      albCtx.lineTo(x2, y2);
      albCtx.stroke();

      bumpCtx.strokeStyle = "#262626";
      bumpCtx.lineWidth = 3;
      bumpCtx.beginPath();
      bumpCtx.moveTo(x1, y1);
      bumpCtx.lineTo(x2, y2);
      bumpCtx.stroke();
    };
    drawSeam(0, 84, size, 84);
    drawSeam(0, 178, size, 178);
    drawSeam(96, 0, 96, 84);
    drawSeam(176, 84, 176, 178);
    drawSeam(64, 178, 96, size);

    // Corner rivets along panel borders
    const rivets = [
      [14, 74],
      [84, 74],
      [108, 74],
      [242, 74],
      [14, 96],
      [164, 96],
      [188, 96],
      [242, 96],
      [18, 190],
      [238, 190],
    ];
    for (const [rx, ry] of rivets) {
      albCtx.fillStyle = "rgba(30,40,56,0.75)";
      albCtx.beginPath();
      albCtx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      albCtx.fill();
      bumpCtx.fillStyle = "#d8d8d8";
      bumpCtx.beginPath();
      bumpCtx.arc(rx, ry, 2.2, 0, Math.PI * 2);
      bumpCtx.fill();
    }
  }

  const albedo = new THREE.CanvasTexture(albCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(2, 2);
  albedo.anisotropy = Math.max(1, maxAnisotropy);
  albedo.needsUpdate = true;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 2);
  bump.anisotropy = Math.max(1, maxAnisotropy);
  bump.needsUpdate = true;

  return { albedo, bump };
}

/**
 * Equirectangular Earth texture with sapphire oceans, continents, polar ice & swirling clouds.
 */
function buildEarthGlobeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const [canvas, ctx] = makeCanvas(w, h);
  if (ctx) {
    // Deep realistic orbital ocean base + crisp polar ice
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, "#d8eeff");
    oceanGrad.addColorStop(0.09, "#0c3570");
    oceanGrad.addColorStop(0.5, "#061b4a");
    oceanGrad.addColorStop(0.91, "#0c3570");
    oceanGrad.addColorStop(1, "#d8eeff");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Detailed multi-lobed continents with emerald & arid highlands
    const clusters: Array<{ x: number; y: number; r: number; col: string }> = [
      { x: 132, y: 82, r: 34, col: "#366844" },
      { x: 158, y: 98, r: 26, col: "#527d4a" },
      { x: 170, y: 146, r: 24, col: "#3c6f42" },
      { x: 184, y: 174, r: 16, col: "#7c754d" },
      { x: 254, y: 74, r: 38, col: "#4a7346" },
      { x: 298, y: 84, r: 42, col: "#687a4e" },
      { x: 282, y: 124, r: 30, col: "#a88f5a" },
      { x: 298, y: 152, r: 22, col: "#487447" },
      { x: 346, y: 92, r: 40, col: "#54794a" },
      { x: 384, y: 108, r: 28, col: "#7b7a53" },
      { x: 404, y: 172, r: 24, col: "#a47f4d" },
    ];
    for (const c of clusters) {
      for (let k = 0; k < 5; k++) {
        const ox = (hash2d(c.x + k, c.y) - 0.5) * c.r * 0.9;
        const oy = (hash2d(c.y, c.x + k * 2) - 0.5) * c.r * 0.65;
        const sr = c.r * (0.52 + hash2d(k * 3.1, c.x) * 0.45);
        const grad = ctx.createRadialGradient(c.x + ox, c.y + oy, 2, c.x + ox, c.y + oy, sr);
        grad.addColorStop(0, c.col);
        grad.addColorStop(0.68, c.col);
        grad.addColorStop(1, "rgba(8,36,88,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x + ox, c.y + oy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Crisp atmospheric cyclonic cloud bands & streaks
    ctx.fillStyle = "#f4faff";
    for (let i = 0; i < 95; i++) {
      const cx = hash2d(i * 3.7, 11.2) * w;
      const cy = 18 + hash2d(5.1, i * 4.9) * (h - 36);
      const rw = 16 + hash2d(i * 1.3, 8.8) * 62;
      const rh = 2.5 + hash2d(6.4, i * 2.1) * 7.5;
      ctx.globalAlpha = 0.22 + hash2d(i, 3.3) * 0.62;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, (hash2d(i, 7.1) - 0.5) * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Seamless multi-channel water detail map:
 * R, G: dual-scale capillary wave height derivatives for normal perturbation
 * B: lacy cellular seafoam web mask for breaking crests & wake froth
 */
function buildOceanDetailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;

    const cellCount = 28;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < cellCount; i++) {
      pts.push({
        x: hash2d(i * 3.1, 7.3),
        y: hash2d(19.7, i * 5.9),
      });
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;

        const rWave =
          Math.sin(u * Math.PI * 6 + Math.cos(v * Math.PI * 4) * 1.1) * 0.35 +
          Math.sin(u * Math.PI * 14 - v * Math.PI * 10) * 0.22 +
          Math.cos(u * Math.PI * 22 + v * Math.PI * 18) * 0.12;
        const gWave =
          Math.cos(v * Math.PI * 6 + Math.sin(u * Math.PI * 4) * 1.1) * 0.35 +
          Math.cos(v * Math.PI * 14 + u * Math.PI * 8) * 0.22 +
          Math.sin(v * Math.PI * 24 - u * Math.PI * 16) * 0.12;

        let d1 = 99;
        let d2 = 99;
        for (let i = 0; i < cellCount; i++) {
          let dx = Math.abs(u - pts[i].x);
          let dy = Math.abs(v - pts[i].y);
          if (dx > 0.5) dx = 1 - dx;
          if (dy > 0.5) dy = 1 - dy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) {
            d2 = d;
          }
        }
        const edgeDist = d2 - d1;
        const foamWeb = Math.max(0, Math.min(1, 1 - edgeDist * 20.0));
        const foamSparkle = Math.max(0, Math.min(1, foamWeb * 0.75 + (hash2d(x, y) - 0.35) * 0.2));

        const idx = (y * size + x) * 4;
        data[idx] = Math.max(0, Math.min(255, Math.round((0.5 + rWave * 0.55) * 255)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round((0.5 + gWave * 0.55) * 255)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(foamSparkle * 255)));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createSideDecalTextures(
  side: Side,
  maxAnisotropy: number,
): SideDecalPack {
  const isA = side === "A";
  const cTop = isA ? "#7ec1fb" : "#95fe7c";
  const cMid = isA ? "#38bdf8" : "#22c55e";
  const cBot = isA ? "#1d4ed8" : "#0ea5e9";

  // 1. Illuminated chest equalizer & horizon perspective grid display
  const [chestCanvas, chestCtx] = makeCanvas(256, 128);
  if (chestCtx) {
    chestCtx.fillStyle = "#040b18";
    chestCtx.fillRect(0, 0, 256, 128);

    // Lower perspective cyber grid floor
    chestCtx.strokeStyle = isA ? "rgba(56,189,248,0.75)" : "rgba(52,245,153,0.75)";
    chestCtx.lineWidth = 1.6;
    for (let i = 0; i <= 8; i++) {
      const topX = 48 + i * 20;
      const botX = 6 + i * 30.5;
      chestCtx.beginPath();
      chestCtx.moveTo(topX, 82);
      chestCtx.lineTo(botX, 128);
      chestCtx.stroke();
    }
    for (const ry of [90, 100, 113, 126]) {
      chestCtx.beginPath();
      chestCtx.moveTo(0, ry);
      chestCtx.lineTo(256, ry);
      chestCtx.stroke();
    }

    // Center glowing WaveWarz 'W' emblem over grid
    chestCtx.strokeStyle = "#e0f7ff";
    chestCtx.lineWidth = 3;
    chestCtx.beginPath();
    chestCtx.moveTo(100, 108);
    chestCtx.lineTo(114, 92);
    chestCtx.lineTo(128, 106);
    chestCtx.lineTo(142, 92);
    chestCtx.lineTo(156, 108);
    chestCtx.stroke();

    // Multi-column illuminated LED EQ spectrum bars
    const heights = [3, 5, 7, 8, 5, 4, 6, 8, 9, 6, 4, 7, 8, 5, 3];
    for (let col = 0; col < heights.length; col++) {
      const bx = 14 + col * 15.6;
      const blocks = heights[col];
      for (let b = 0; b < blocks; b++) {
        const frac = b / 9;
        chestCtx.fillStyle = frac > 0.65 ? cTop : frac > 0.3 ? cMid : cBot;
        chestCtx.fillRect(bx, 74 - b * 7.5, 11.5, 5.2);
      }
    }
  }
  const eqChestMap = new THREE.CanvasTexture(chestCanvas);
  eqChestMap.colorSpace = THREE.SRGBColorSpace;
  eqChestMap.anisotropy = Math.max(1, maxAnisotropy);
  eqChestMap.needsUpdate = true;

  // 2. Shoulder pauldron glowing 5-column EQ badge
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  if (shCtx) {
    shCtx.fillStyle = "#06111f";
    shCtx.fillRect(0, 0, 128, 128);
    const cols = [4, 7, 9, 6, 3];
    for (let c = 0; c < cols.length; c++) {
      for (let b = 0; b < cols[c]; b++) {
        shCtx.fillStyle = b >= 6 ? cTop : b >= 3 ? cMid : cBot;
        shCtx.fillRect(14 + c * 21, 104 - b * 10.5, 15, 7.2);
      }
    }
  }
  const eqShoulderMap = new THREE.CanvasTexture(shCanvas);
  eqShoulderMap.colorSpace = THREE.SRGBColorSpace;
  eqShoulderMap.anisotropy = Math.max(1, maxAnisotropy);
  eqShoulderMap.needsUpdate = true;

  // 3. Surfboard glowing cyber perspective grid deck
  const [bdCanvas, bdCtx] = makeCanvas(256, 512);
  if (bdCtx) {
    bdCtx.fillStyle = "#06101e";
    bdCtx.fillRect(0, 0, 256, 512);

    const glow = bdCtx.createLinearGradient(0, 0, 0, 512);
    glow.addColorStop(0, cTop);
    glow.addColorStop(0.5, cMid);
    glow.addColorStop(1, cBot);

    bdCtx.strokeStyle = glow;
    bdCtx.lineWidth = 2.5;
    for (let x = 28; x <= 228; x += 25) {
      bdCtx.beginPath();
      bdCtx.moveTo(x, 12);
      bdCtx.lineTo(x, 500);
      bdCtx.stroke();
    }
    for (let y = 24; y <= 492; y += 32) {
      bdCtx.beginPath();
      bdCtx.moveTo(14, y);
      bdCtx.lineTo(242, y);
      bdCtx.stroke();
    }

    // Center high-luminance pulse spine
    bdCtx.strokeStyle = "#e8fbff";
    bdCtx.lineWidth = 4;
    bdCtx.beginPath();
    bdCtx.moveTo(128, 14);
    bdCtx.lineTo(128, 498);
    bdCtx.stroke();
  }
  const boardGridMap = new THREE.CanvasTexture(bdCanvas);
  boardGridMap.colorSpace = THREE.SRGBColorSpace;
  boardGridMap.anisotropy = Math.max(1, maxAnisotropy);
  boardGridMap.needsUpdate = true;

  // 4. Translucent glowing waveform burst map for holographic energy wings & ear cups
  const [wfCanvas, wfCtx] = makeCanvas(256, 128);
  if (wfCtx) {
    wfCtx.clearRect(0, 0, 256, 128);
    const barCount = 46;
    for (let i = 0; i < barCount; i++) {
      const distMid = Math.abs(i - (barCount - 1) * 0.5) / (barCount * 0.5);
      const env = Math.pow(1 - distMid, 1.35);
      const spike = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.92) * Math.cos(i * 0.37));
      const hBar = Math.max(4, env * spike * 112);
      const x = (i / barCount) * 256;
      const g = wfCtx.createLinearGradient(0, 64 - hBar / 2, 0, 64 + hBar / 2);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.25, cTop);
      g.addColorStop(0.5, "#ffffff");
      g.addColorStop(0.75, cMid);
      g.addColorStop(1, "rgba(255,255,255,0)");
      wfCtx.fillStyle = g;
      wfCtx.fillRect(x, 64 - hBar / 2, 3.6, hBar);
    }
  }
  const waveformMap = new THREE.CanvasTexture(wfCanvas);
  waveformMap.colorSpace = THREE.SRGBColorSpace;
  waveformMap.anisotropy = Math.max(1, maxAnisotropy);
  waveformMap.needsUpdate = true;

  return {
    eqChestMap,
    eqShoulderMap,
    boardGridMap,
    waveformMap,
    dispose: () => {
      eqChestMap.dispose();
      eqShoulderMap.dispose();
      boardGridMap.dispose();
      waveformMap.dispose();
    },
  };
}

export interface DjTexturePack {
  vinylGrooveMap: THREE.CanvasTexture;
  mixerFaceMap: THREE.CanvasTexture;
  speakerGrilleMap: THREE.CanvasTexture;
  stageFloorMap: THREE.CanvasTexture;
  dispose: () => void;
}

function buildVinylGrooveTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    // Deep glossy black vinyl pressing base
    ctx.fillStyle = "#080b12";
    ctx.fillRect(0, 0, size, size);

    // Anisotropic vinyl highlight wedges (iconic "hourglass" reflection across grooves)
    for (const angOffset of [0.35, Math.PI + 0.35]) {
      const grad = ctx.createRadialGradient(cx, cy, 36, cx, cy, 248);
      grad.addColorStop(0, "rgba(180,225,255,0.03)");
      grad.addColorStop(0.45, "rgba(190,230,255,0.16)");
      grad.addColorStop(0.85, "rgba(160,210,255,0.08)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 250, angOffset - 0.38, angOffset + 0.38);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Fine concentric pressing grooves + track cue bands
    for (let r = 82; r <= 236; r += 2.6) {
      const band = Math.sin(r * 0.22) * 0.5 + 0.5;
      const trackBreak = r % 36 < 3 ? 0.14 : 0.04 + band * 0.08;
      ctx.strokeStyle = `rgba(185, 220, 255, ${trackBreak.toFixed(3)})`;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer metallic platter strobe pitch dots
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const px = cx + Math.cos(a) * 246;
      const py = cy + Math.sin(a) * 246;
      ctx.fillStyle = i % 4 === 0 ? "rgba(235, 248, 255, 0.85)" : "rgba(126, 193, 251, 0.45)";
      ctx.beginPath();
      ctx.arc(px, py, i % 4 === 0 ? 2.4 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function buildMixerFaceplateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const [canvas, ctx] = makeCanvas(w, h);
  if (ctx) {
    ctx.fillStyle = "#0b111d";
    ctx.fillRect(0, 0, w, h);

    // Subtle brushed chassis finish
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(0, y, w, 1.5);
    }

    // Deck border trim & channel divider lines
    ctx.strokeStyle = "rgba(126,193,251,0.38)";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(160, 16);
    ctx.lineTo(160, h - 16);
    ctx.moveTo(352, 16);
    ctx.lineTo(352, h - 16);
    ctx.stroke();

    // Central dual stereo VU level strips
    for (let row = 0; row < 12; row++) {
      const y = 32 + row * 12;
      const col = row < 2 ? "#ef4444" : row < 5 ? "#e5c25a" : "#7ec1fb";
      const colB = row < 2 ? "#ef4444" : row < 5 ? "#e5c25a" : "#95fe7c";
      ctx.fillStyle = col;
      ctx.fillRect(230, y, 16, 7);
      ctx.fillStyle = colB;
      ctx.fillRect(266, y, 16, 7);
    }

    // Fader slot ticks
    ctx.strokeStyle = "rgba(220,240,255,0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) {
      const x = 186 + i * 17.5;
      ctx.beginPath();
      ctx.moveTo(x, 206);
      ctx.lineTo(x, 224);
      ctx.stroke();
    }

    // Backlit hot-cue trigger pad outlines
    const padColors = ["#7ec1fb", "#95fe7c", "#e5c25a", "#76f3df"];
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const ox = sideIdx === 0 ? 24 : 374;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "rgba(15,24,42,0.95)";
        ctx.fillRect(ox + i * 28, 186, 22, 22);
        ctx.strokeStyle = padColors[i];
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + i * 28, 186, 22, 22);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function buildSpeakerGrilleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  if (ctx) {
    ctx.fillStyle = "#0e1522";
    ctx.fillRect(0, 0, size, size);

    // Fine honeycomb perforation grid
    ctx.fillStyle = "#04070d";
    for (let y = 6; y < size; y += 10) {
      const shift = (Math.floor(y / 10) % 2) * 5;
      for (let x = 6; x < size; x += 10) {
        ctx.beginPath();
        ctx.arc((x + shift) % size, y, 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function buildStageFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  if (ctx) {
    ctx.fillStyle = "#050912";
    ctx.fillRect(0, 0, size, size);

    // Subtle dark brushed concert flooring seams & grip micro-dots
    ctx.strokeStyle = "rgba(56, 130, 196, 0.14)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(18, 30, 50, 0.55)";
    for (let y = 16; y < size; y += 32) {
      for (let x = 16; x < size; x += 32) {
        ctx.fillRect(x, y, 3, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 12);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createDjTexturePack(maxAnisotropy: number): DjTexturePack {
  const vinylGrooveMap = buildVinylGrooveTexture(maxAnisotropy);
  const mixerFaceMap = buildMixerFaceplateTexture(maxAnisotropy);
  const speakerGrilleMap = buildSpeakerGrilleTexture(maxAnisotropy);
  const stageFloorMap = buildStageFloorTexture(maxAnisotropy);

  return {
    vinylGrooveMap,
    mixerFaceMap,
    speakerGrilleMap,
    stageFloorMap,
    dispose: () => {
      vinylGrooveMap.dispose();
      mixerFaceMap.dispose();
      speakerGrilleMap.dispose();
      stageFloorMap.dispose();
    },
  };
}

export function createSceneTexturePack(maxAnisotropy: number): SceneTexturePack {
  const neopreneBump = buildNeopreneTexture(maxAnisotropy);
  const lunarRegolithBump = buildLunarRegolithTexture(maxAnisotropy);
  const { albedo: armorAlbedo, bump: armorBump } = buildCyberArmorTextures(maxAnisotropy);
  const earthGlobeMap = buildEarthGlobeTexture(maxAnisotropy);
  const oceanDetail = buildOceanDetailTexture(maxAnisotropy);

  return {
    neopreneBump,
    lunarRegolithBump,
    armorAlbedo,
    armorBump,
    earthGlobeMap,
    oceanDetail,
    dispose: () => {
      neopreneBump.dispose();
      lunarRegolithBump.dispose();
      armorAlbedo.dispose();
      armorBump.dispose();
      earthGlobeMap.dispose();
      oceanDetail.dispose();
    },
  };
}
