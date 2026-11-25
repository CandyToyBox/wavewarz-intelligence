export type Side = "A" | "B";
export type ArenaTheme = "dj" | "surf" | "racer" | "dancer";
export type SurferStyle = "pro" | "queen";
export type ViewMode = "arena" | "trader" | "api";
export type FactorWinner = Side | "tie";

export type WearableId =
  | "headphones"
  | "shades"
  | "hydroWings"
  | "soundCrown"
  | "reverbCape";

export type TrickType =
  | "idle"
  | "carve"
  | "indyGrab"
  | "spin360"
  | "megaTsunami"
  | "wipeoutWobble"
  | "grandFinale";

export interface SurferTier {
  level: number;
  title: string;
  minSol: number;
  scale: number;
  wearables: WearableId[];
}

export const SURFER_TIERS: readonly SurferTier[] = [
  {
    level: 1,
    title: "Grom Rider",
    minSol: 0,
    scale: 1.0,
    wearables: [],
  },
  {
    level: 2,
    title: "Wave Carver",
    minSol: 5,
    scale: 1.08,
    wearables: ["headphones"],
  },
  {
    level: 3,
    title: "Chart Ripper",
    minSol: 15,
    scale: 1.16,
    wearables: ["headphones", "shades", "hydroWings"],
  },
  {
    level: 4,
    title: "Tidal Boss",
    minSol: 35,
    scale: 1.24,
    wearables: ["headphones", "shades", "hydroWings", "soundCrown"],
  },
  {
    level: 5,
    title: "Wave Legend",
    minSol: 65,
    scale: 1.32,
    wearables: ["headphones", "shades", "hydroWings", "soundCrown", "reverbCape"],
  },
];

export const DJ_TIER_TITLES: Record<number, string> = {
  1: "Portable Deck",
  2: "Club Mixer",
  3: "Sub Stack",
  4: "Laser Rig",
  5: "Mainstage Titan",
};

export const RACER_TIER_TITLES: Record<number, string> = {
  1: "Sleek Pod",
  2: "Aero Cruiser",
  3: "Sonic Ripper",
  4: "Overdrive Racer",
  5: "Winged Titan",
};

export const DANCER_TIER_TITLES: Record<number, string> = {
  1: "Street Busker",
  2: "Groove B-Boy",
  3: "Alley Popper",
  4: "Battle Champ",
  5: "Pop Art Icon",
};

export const WEARABLE_LABELS: Record<WearableId, string> = {
  headphones: "Studio DJ Cans",
  shades: "Prism Visor Shades",
  hydroWings: "Board Hydro-Wings",
  soundCrown: "EQ Halo Crown",
  reverbCape: "Reverb Energy Wings",
};

export const DJ_WEARABLE_LABELS: Record<WearableId, string> = {
  headphones: "Studio DJ Cans",
  shades: "Prism Visor Shades",
  hydroWings: "EQ Speaker Stacks",
  soundCrown: "Laser Halo Crown",
  reverbCape: "Arena Sub & Laser Wings",
};

export const RACER_WEARABLE_LABELS: Record<WearableId, string> = {
  headphones: "Aero Head-Pods",
  shades: "Prism Windscreen",
  hydroWings: "Sonic Canard Winglets",
  soundCrown: "Overdrive Halo Spoiler",
  reverbCape: "Overdrive Laser Wings",
};

export const DANCER_WEARABLE_LABELS: Record<WearableId, string> = {
  headphones: "Chunky Street Cans",
  shades: "Pop-Art Shutter Shades",
  hydroWings: "Boombox Boom-Pack",
  soundCrown: "Graffiti Halo Crown",
  reverbCape: "LED Puffer & Comic Aura",
};

export function getTierDisplayTitle(tier: SurferTier, theme: ArenaTheme): string {
  if (theme === "dj") {
    return DJ_TIER_TITLES[tier.level] ?? tier.title;
  }
  if (theme === "racer") {
    return RACER_TIER_TITLES[tier.level] ?? tier.title;
  }
  if (theme === "dancer") {
    return DANCER_TIER_TITLES[tier.level] ?? tier.title;
  }
  return tier.title;
}

export function getWearableDisplayLabel(id: WearableId, theme: ArenaTheme): string {
  if (theme === "dj") {
    return DJ_WEARABLE_LABELS[id];
  }
  if (theme === "racer") {
    return RACER_WEARABLE_LABELS[id];
  }
  if (theme === "dancer") {
    return DANCER_WEARABLE_LABELS[id];
  }
  return WEARABLE_LABELS[id];
}

export const AURA_TIER2_SOL = 15;
export const AURA_TIER3_SOL = 35;
export const AURA_MAX_SOL = 70;
export const TOKENS_PER_SOL = 700_000;

export const ARTIST_WIN_SPLIT = 0.05;
export const ARTIST_LOSE_SPLIT = 0.02;
export const PLATFORM_SPLIT = 0.03;
export const TRADER_WIN_VAULT_SPLIT = 0.4;
export const TRADER_LOSE_VAULT_SPLIT = 0.5;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getSurferTier(poolSol: number): SurferTier {
  const safePool = Math.max(0, Number.isFinite(poolSol) ? poolSol : 0);
  let active = SURFER_TIERS[0];
  for (let i = 0; i < SURFER_TIERS.length; i++) {
    if (safePool >= SURFER_TIERS[i].minSol) {
      active = SURFER_TIERS[i];
    }
  }
  return active;
}

export function getAuraState(poolSol: number): { tier: 0 | 1 | 2 | 3; strength: number } {
  const pool = Math.max(0, Number.isFinite(poolSol) ? poolSol : 0);
  const tier: 0 | 1 | 2 | 3 =
    pool <= 0 ? 0 : pool < AURA_TIER2_SOL ? 1 : pool < AURA_TIER3_SOL ? 2 : 3;
  return {
    tier,
    strength: clamp(pool / AURA_MAX_SOL, 0, 1),
  };
}

export const WAVE_DIFF_MAX_SOL = 60;

export interface OceanWaveParams {
  poolDiff: number;
  roughness01: number;
  amplitudeMultiplier: number;
  frequencyMultiplier: number;
  speedMultiplier: number;
  foamBoost: number;
}

export function computeOceanWaveParams(poolA: number, poolB: number): OceanWaveParams {
  const safeA = Math.max(0, Number.isFinite(poolA) ? poolA : 0);
  const safeB = Math.max(0, Number.isFinite(poolB) ? poolB : 0);
  const poolDiff = Math.abs(safeA - safeB);
  const linear = clamp(poolDiff / WAVE_DIFF_MAX_SOL, 0, 1);
  const roughness01 = Math.pow(linear, 0.72);

  return {
    poolDiff,
    roughness01,
    amplitudeMultiplier: 1.0 + roughness01 * 1.15,
    frequencyMultiplier: 1.0 + roughness01 * 0.85,
    speedMultiplier: 1.0 + roughness01 * 0.7,
    foamBoost: roughness01 * 0.32,
  };
}

export interface DjArenaDynamics {
  poolDiff: number;
  heat01: number;
  bpm: number;
  strobeIntensity: number;
  coneExcursion: number;
  crowdGlow: number;
  spinBoost: number;
}

export function computeDjArenaDynamics(poolA: number, poolB: number): DjArenaDynamics {
  const safeA = Math.max(0, Number.isFinite(poolA) ? poolA : 0);
  const safeB = Math.max(0, Number.isFinite(poolB) ? poolB : 0);
  const poolDiff = Math.abs(safeA - safeB);
  const linear = clamp(poolDiff / WAVE_DIFF_MAX_SOL, 0, 1);
  const heat01 = Math.pow(linear, 0.72);

  return {
    poolDiff,
    heat01,
    bpm: Math.round(118 + heat01 * 34),
    strobeIntensity: 0.18 + heat01 * 0.82,
    coneExcursion: 0.28 + heat01 * 0.72,
    crowdGlow: 0.26 + heat01 * 0.74,
    spinBoost: 1.0 + heat01 * 0.65,
  };
}

export interface RacerArenaDynamics {
  poolDiff: number;
  heat01: number;
  trackSpeed: number;
  bankingAngle: number;
  leadDistance: number;
  tunnelParallax: number;
  trailWidth: number;
}

export function computeRacerArenaDynamics(poolA: number, poolB: number): RacerArenaDynamics {
  const safeA = Math.max(0, Number.isFinite(poolA) ? poolA : 0);
  const safeB = Math.max(0, Number.isFinite(poolB) ? poolB : 0);
  const poolDiff = Math.abs(safeA - safeB);
  const linear = clamp(poolDiff / WAVE_DIFF_MAX_SOL, 0, 1);
  const heat01 = Math.pow(linear, 0.72);

  // Signed lead offset: poolA - poolB normalized (-1.2 to +1.2 meters)
  const rawDiff = safeA - safeB;
  const leadNorm = clamp(rawDiff / 40, -1, 1);
  const leadDistance = leadNorm * 1.15;

  // Real-time track & camera banking tilt (rad) based on leader (positive tilts towards Side A)
  const bankingAngle = clamp((safeA - safeB) / 50, -1, 1) * 0.22;

  return {
    poolDiff,
    heat01,
    trackSpeed: 1.0 + heat01 * 0.85,
    bankingAngle,
    leadDistance,
    tunnelParallax: 1.0 + heat01 * 1.1,
    trailWidth: 1.0 + heat01 * 0.75,
  };
}

export interface DancerArenaDynamics {
  poolDiff: number;
  heat01: number;
  bpm: number;
  tilePulseSpeed: number;
  graffitiGlow: number;
  spotlightSweep: number;
  crowdCheer: number;
  boomboxExcursion: number;
}

export function computeDancerArenaDynamics(poolA: number, poolB: number): DancerArenaDynamics {
  const safeA = Math.max(0, Number.isFinite(poolA) ? poolA : 0);
  const safeB = Math.max(0, Number.isFinite(poolB) ? poolB : 0);
  const poolDiff = Math.abs(safeA - safeB);
  const linear = clamp(poolDiff / WAVE_DIFF_MAX_SOL, 0, 1);
  const heat01 = Math.pow(linear, 0.72);

  return {
    poolDiff,
    heat01,
    bpm: Math.round(112 + heat01 * 36),
    tilePulseSpeed: 1.0 + heat01 * 1.25,
    graffitiGlow: 0.35 + heat01 * 0.65,
    spotlightSweep: 1.0 + heat01 * 1.5,
    crowdCheer: 0.2 + heat01 * 0.8,
    boomboxExcursion: 0.3 + heat01 * 0.7,
  };
}

export interface TradeTrickPlan {
  trick: TrickType;
  power01: number;
  waveSurge: number;
  durationMs: number;
  label: string;
}

export function classifyTradeAction(sol: number, kind: "buy" | "sell"): TradeTrickPlan {
  const safeSol = Math.max(0, Number.isFinite(sol) ? sol : 0);
  const logScale = Math.log2(1 + safeSol) / Math.log2(1 + 50);
  const power01 = clamp(logScale, 0, 1);

  if (kind === "sell") {
    return {
      trick: "wipeoutWobble",
      power01: clamp(power01 * 0.8 + 0.15, 0.15, 1),
      waveSurge: -clamp(0.4 + power01 * 0.9, 0.4, 1.3),
      durationMs: 780,
      label: "Wipeout Wobble",
    };
  }

  if (safeSol >= 25) {
    return {
      trick: "megaTsunami",
      power01: 1,
      waveSurge: 2.6,
      durationMs: 1450,
      label: "720° Mega Tsunami Launch",
    };
  }
  if (safeSol >= 8) {
    return {
      trick: "spin360",
      power01: clamp(0.6 + power01 * 0.4, 0.6, 0.98),
      waveSurge: 1.85,
      durationMs: 1120,
      label: "360° Barrel Aerial",
    };
  }
  if (safeSol >= 3) {
    return {
      trick: "indyGrab",
      power01: clamp(0.35 + power01 * 0.35, 0.35, 0.72),
      waveSurge: 1.2,
      durationMs: 880,
      label: "Indy Grab Air",
    };
  }
  return {
    trick: "carve",
    power01: clamp(0.15 + power01 * 0.3, 0.15, 0.45),
    waveSurge: 0.68,
    durationMs: 650,
    label: "Cutback Carve",
  };
}

export function classifyTradeActionForTheme(
  sol: number,
  kind: "buy" | "sell",
  theme: ArenaTheme,
): TradeTrickPlan {
  const base = classifyTradeAction(sol, kind);
  if (theme === "surf") {
    return base;
  }

  if (theme === "racer") {
    switch (base.trick) {
      case "wipeoutWobble":
        return { ...base, label: "Air-Brake Drag & Shield Sparks" };
      case "megaTsunami":
        return { ...base, label: "Overdrive Sonic Boom Barrel Roll" };
      case "spin360":
        return { ...base, label: "360° Aerial Jump" };
      case "indyGrab":
        return { ...base, label: "Slipstream Nitro Boost" };
      case "carve":
      default:
        return { ...base, label: "Drafting Slalom" };
    }
  }

  if (theme === "dancer") {
    switch (base.trick) {
      case "wipeoutWobble":
        return { ...base, label: "Off-Beat Slip & Comic Stumble" };
      case "megaTsunami":
        return { ...base, label: "Air-Flare Freeze & BOOM!" };
      case "spin360":
        return { ...base, label: "360° Moonwalk Spin" };
      case "indyGrab":
        return { ...base, label: "Toprock Power Move" };
      case "carve":
      default:
        return { ...base, label: "Downrock Step Groove" };
    }
  }

  switch (base.trick) {
    case "wipeoutWobble":
      return { ...base, label: "Needle Skip & Power Dip" };
    case "megaTsunami":
      return { ...base, label: "Mainstage Bass Drop" };
    case "spin360":
      return { ...base, label: "Laser Sweep Scratch" };
    case "indyGrab":
      return { ...base, label: "Flare & Bass Cannon" };
    case "carve":
    default:
      return { ...base, label: "Baby Scratch Combo" };
  }
}

export interface BattleScoreInputs {
  poolA: number;
  poolB: number;
  djWaveyA: number;
  djWaveyB: number;
  pollA: number;
  pollB: number;
}

export interface EndBattlePayout {
  loserPool: number;
  winningArtistSol: number;
  losingArtistSol: number;
  platformSol: number;
  winningTradersVaultSol: number;
  losingTradersVaultSol: number;
}

export interface BattleOutcome {
  factors: {
    trading: FactorWinner;
    djWavey: FactorWinner;
    audiencePoll: FactorWinner;
  };
  factorScoreA: number;
  factorScoreB: number;
  winner: FactorWinner;
  decidedByTiebreaker: boolean;
  payout: EndBattlePayout | null;
}

export function determineBattleOutcome(input: BattleScoreInputs): BattleOutcome {
  const trading: FactorWinner =
    input.poolA > input.poolB ? "A" : input.poolB > input.poolA ? "B" : "tie";
  const djWavey: FactorWinner =
    input.djWaveyA > input.djWaveyB ? "A" : input.djWaveyB > input.djWaveyA ? "B" : "tie";
  const audiencePoll: FactorWinner =
    input.pollA > input.pollB ? "A" : input.pollB > input.pollA ? "B" : "tie";

  let factorScoreA = 0;
  let factorScoreB = 0;
  [trading, djWavey, audiencePoll].forEach((f) => {
    if (f === "A") factorScoreA += 1;
    else if (f === "B") factorScoreB += 1;
  });

  let winner: FactorWinner = "tie";
  let decidedByTiebreaker = false;

  if (factorScoreA > factorScoreB) {
    winner = "A";
  } else if (factorScoreB > factorScoreA) {
    winner = "B";
  } else if (trading !== "tie") {
    winner = trading;
    decidedByTiebreaker = true;
  }

  let payout: EndBattlePayout | null = null;
  if (winner !== "tie") {
    const loserPool = Math.max(0, winner === "A" ? input.poolB : input.poolA);
    payout = {
      loserPool,
      winningArtistSol: loserPool * ARTIST_WIN_SPLIT,
      losingArtistSol: loserPool * ARTIST_LOSE_SPLIT,
      platformSol: loserPool * PLATFORM_SPLIT,
      winningTradersVaultSol: loserPool * TRADER_WIN_VAULT_SPLIT,
      losingTradersVaultSol: loserPool * TRADER_LOSE_VAULT_SPLIT,
    };
  }

  return {
    factors: { trading, djWavey, audiencePoll },
    factorScoreA,
    factorScoreB,
    winner,
    decidedByTiebreaker,
    payout,
  };
}

export function formatSol(val: number): string {
  const safe = Math.max(0, Number.isFinite(val) ? val : 0);
  if (safe === 0) return "0.00";
  if (safe < 1) return safe.toFixed(3);
  if (safe < 10) return safe.toFixed(2);
  return safe.toFixed(1);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function estimateTokens(sol: number): number {
  const safe = Math.max(0, Number.isFinite(sol) ? sol : 0);
  return Math.round(safe * TOKENS_PER_SOL);
}
