import type { Side, SurferStyle, TrickType } from "@/lib/games/battle-logic";

export interface ArenaTriggerPayload {
  side: Side;
  trick: TrickType;
  power01: number;
  waveSurge: number;
  durationMs: number;
}

export interface ArenaEngine {
  syncSurferPools: (poolA: number, poolB: number) => void;
  triggerTrick: (payload: ArenaTriggerPayload) => void;
  triggerGrandFinale: (winner: Side | "tie") => void;
  triggerCoinSplit: (winner: Side) => void;
  setSurferPhoto: (side: Side, source: string) => void;
  setSurferFlip: (side: Side, flipX: boolean) => void;
  setSurferStyle: (side: Side, style: SurferStyle) => void;
  reset: () => void;
  getOceanWaveState: () => {
    wavePhase: number;
    amplitudeMultiplier: number;
    frequencyMultiplier: number;
    speedMultiplier: number;
    roughness01: number;
    poolDiff: number;
    bpm?: number;
    coneExcursion?: number;
    crowdGlow?: number;
    strobeIntensity?: number;
    bankingAngle?: number;
    leadDistance?: number;
    trackSpeed?: number;
  };
  dispose: () => void;
}
