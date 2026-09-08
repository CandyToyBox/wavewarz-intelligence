// ==========================================
// WAVEWARZ MATH ENGINE
// All inputs/outputs in SOL. USD conversion handled in the UI via getLiveSolPrice().
// All formulas mirror the onchain smart contract exactly.
// NEVER use main_event_rounds data for financial calculations.
// ==========================================

// ==========================================
// ARTIST EARNINGS
// ==========================================
// The trade fee is 1.500% of gross buy volume, and the program splits it 67/33
// artist-to-platform — so the artist leg is 1.005% and the platform leg 0.495%,
// NOT the 1.00%/0.50% the whitepaper and fee schedule state. Measured on chain:
// the artist leg lands at exactly 1.0050% across a 223-buy sample (aggregate and
// per-buy median), the platform leg at 0.4950% (per-buy median). Confirmed
// against Zaal's decode (bettercallzaal/wavewarz-protocol recon/ARTIST-EARNINGS.md,
// exact lamports on 14 trades). Always state all three parts — "1.005%" alone
// reads as a typo for 1.00%.
export function calculateArtistEarnings(
  artistTotalVolume: number,
  loserPoolTotal: number,
  isWinner: boolean
) {
  const tradingFees = artistTotalVolume * 0.01005
  const settlementBonus = loserPoolTotal * (isWinner ? 0.05 : 0.02)

  return {
    tradingFees,
    settlementBonus,
    totalSol: tradingFees + settlementBonus,
  }
}

// ==========================================
// PLATFORM REVENUE
// ==========================================
export function calculatePlatformRevenue(
  totalPlatformVolume: number,
  totalLoserPools: number
) {
  // Platform leg of the 1.500% trade fee — 33% of it, i.e. 0.495% (see
  // calculateArtistEarnings). Was 0.50%.
  const tradingFees = totalPlatformVolume * 0.00495
  const settlementBonus = totalLoserPools * 0.03

  return {
    tradingFees,
    settlementBonus,
    totalSol: tradingFees + settlementBonus,
  }
}

// ==========================================
// TRADER PAYOUT & ROI
// ==========================================
export function calculateTraderPayout(
  isWinnerSide: boolean,
  traderTokens: number,
  totalTokenSupply: number,
  winnerPool: number,
  loserPool: number,
  initialInvestment: number
) {
  const shareOfPool = totalTokenSupply > 0 ? traderTokens / totalTokenSupply : 0
  let totalPayout = 0

  if (isWinnerSide) {
    totalPayout = shareOfPool * winnerPool + shareOfPool * (loserPool * 0.40)
  } else {
    totalPayout = shareOfPool * loserPool * 0.50
  }

  const roiPercentage =
    initialInvestment > 0
      ? ((totalPayout - initialInvestment) / initialInvestment) * 100
      : 0

  return {
    shareOfPool,
    totalPayout,
    roiPercentage,
  }
}

// ==========================================
// LOSER POOL SETTLEMENT BREAKDOWN
// Verify: all shares sum to exactly 100%
// ==========================================
export function calculateSettlementBreakdown(loserPool: number) {
  return {
    losingTraders: loserPool * 0.50,   // 50% — pro-rata refund
    winningTraders: loserPool * 0.40,  // 40% — bonus to winners
    winningArtist: loserPool * 0.05,   // 5%  — settlement bonus
    losingArtist: loserPool * 0.02,    // 2%  — consolation bonus
    platform: loserPool * 0.03,        // 3%  — WaveWarz treasury
  }
}

// ==========================================
// HELPERS
// ==========================================

/** Identify winner/loser pool from raw battle data */
export function getWinnerLoserPools(
  artist1Pool: number,
  artist2Pool: number,
  winnerArtistA: boolean
) {
  return {
    winnerPool: winnerArtistA ? artist1Pool : artist2Pool,
    loserPool: winnerArtistA ? artist2Pool : artist1Pool,
  }
}

/** Format SOL to max 4 decimal places, stripping trailing zeros */
export function formatSol(sol: number): string {
  return parseFloat(sol.toFixed(4)).toString()
}

/** Format ROI with sign */
export function formatRoi(roi: number): string {
  const sign = roi >= 0 ? '+' : ''
  return `${sign}${roi.toFixed(1)}%`
}
