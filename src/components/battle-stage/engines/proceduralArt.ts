import type { Side } from "@/lib/games/battle-logic";

/**
 * Generates high-contrast procedural album art on an offscreen HTML5 2D canvas
 * so both the rotated broadcast panels and the 3D surfer head visor display
 * crisp artwork out of the box with zero external image fetches or 404s.
 */
export function createDefaultAlbumCanvas(side: Side): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const isA = side === "A";
  const primary = isA ? "#7ec1fb" : "#95fe7c";
  const secondary = isA ? "#38bdf8" : "#22c55e";
  const highlight = isA ? "#e0f2fe" : "#ecfccb";
  const deepBg = isA ? "#08142b" : "#071a15";
  const midBg = isA ? "#11284e" : "#0f3325";

  // 1. Deep nocturnal gradient
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, deepBg);
  bgGrad.addColorStop(0.55, midBg);
  bgGrad.addColorStop(1, "#060b16");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. Radial atmospheric halo
  const halo = ctx.createRadialGradient(size * 0.5, size * 0.44, 24, size * 0.5, size * 0.44, 235);
  halo.addColorStop(0, isA ? "rgba(126,193,251,0.52)" : "rgba(149,254,124,0.5)");
  halo.addColorStop(0.5, isA ? "rgba(56,189,248,0.18)" : "rgba(34,197,94,0.18)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // 3. Concentric vinyl / synthwave sonar rings
  ctx.strokeStyle = isA ? "rgba(126,193,251,0.28)" : "rgba(149,254,124,0.28)";
  for (let r = 84; r <= 230; r += 26) {
    ctx.lineWidth = r === 136 ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.45, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. Stylized sonic wave crest emblem
  ctx.save();
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.45, 132, 0, Math.PI * 2);
  ctx.clip();

  const sunGrad = ctx.createLinearGradient(0, 90, 0, 355);
  sunGrad.addColorStop(0, highlight);
  sunGrad.addColorStop(0.5, primary);
  sunGrad.addColorStop(1, secondary);
  ctx.fillStyle = sunGrad;
  ctx.fillRect(100, 90, 312, 270);

  // Horizontal scanline slices across lower sun disc
  ctx.fillStyle = deepBg;
  for (let i = 0; i < 6; i++) {
    const y = 212 + i * 24;
    const h = 4 + i * 2.2;
    ctx.fillRect(100, y, 312, h);
  }

  // Curling barrel wave silhouette inside disc
  ctx.fillStyle = "#060d1b";
  ctx.beginPath();
  ctx.moveTo(100, 360);
  ctx.lineTo(100, 295);
  ctx.bezierCurveTo(175, 290, 200, 175, 295, 192);
  ctx.bezierCurveTo(338, 200, 352, 232, 326, 250);
  ctx.bezierCurveTo(298, 268, 266, 236, 236, 262);
  ctx.bezierCurveTo(212, 282, 240, 312, 310, 305);
  ctx.bezierCurveTo(355, 300, 385, 278, 412, 268);
  ctx.lineTo(412, 360);
  ctx.closePath();
  ctx.fill();

  // Sharp surf fin carving across the crest
  ctx.fillStyle = highlight;
  ctx.beginPath();
  if (isA) {
    ctx.moveTo(228, 252);
    ctx.quadraticCurveTo(256, 178, 296, 190);
    ctx.quadraticCurveTo(272, 224, 264, 252);
  } else {
    ctx.moveTo(284, 252);
    ctx.quadraticCurveTo(256, 178, 216, 190);
    ctx.quadraticCurveTo(240, 224, 248, 252);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 5. Crisp perimeter double bezel
  ctx.strokeStyle = primary;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.45, 134, 0, Math.PI * 2);
  ctx.stroke();

  // 6. Subtle bottom audio spectrum reflection bars
  const barCount = 24;
  const startX = 76;
  const stepX = (size - 152) / barCount;
  for (let i = 0; i < barCount; i++) {
    const wave = Math.sin(i * 0.55 + (isA ? 0.3 : 2.1)) * 0.5 + 0.5;
    const bh = 14 + wave * 34;
    ctx.fillStyle = i % 2 === 0 ? primary : secondary;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(startX + i * stepX, size - 56 - bh, stepX * 0.65, bh);
  }
  ctx.globalAlpha = 1;

  // 7. Outer sleeve frame border
  ctx.strokeStyle = isA ? "rgba(126,193,251,0.38)" : "rgba(149,254,124,0.38)";
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, size - 24, size - 24);

  return canvas;
}

export function createDefaultAlbumArt(side: Side): string {
  const canvas = createDefaultAlbumCanvas(side);
  return canvas ? canvas.toDataURL("image/png") : "";
}

/**
 * Generates a soft radial particle/glow texture for Three.js contact grounding.
 */
export function createRadialGlowTexture(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.35, "rgba(255, 255, 255, 0.45)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}
