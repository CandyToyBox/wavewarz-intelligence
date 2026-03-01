// ==========================================
// WAVEWARZ MATH ENGINE
// All inputs/outputs in SOL. USD conversion handled in the UI via getLiveSolPrice().
// All formulas mirror the onchain smart contract exactly.
// NEVER use main_event_rounds data for financial calculations.
// ==========================================

// ==========================================
// ARTIST EARNINGS
// ==========================================
export function calculateArtistEarnings(
  artistTotalVolume: number,
  loserPoolTotal: number,
  isWinner: boolean
) {
  const tradingFees = artistTotalVolume * 0.01
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
  const tradingFees = totalPlatformVolume * 0.005
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
