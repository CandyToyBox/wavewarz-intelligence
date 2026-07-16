#!/bin/bash
# WaveWarz Statz — nightly data integrity check.
#
# Re-runs the two chain-parsing fixes that corrected historical volume/PNL
# corruption, scoped to recent activity so it stays fast:
#   1. fix-volume-from-chain.ts (default mode) — re-detects and corrects any
#      battle where the webhook's degraded-mode fallback wrote artist_sol_balance
#      into total_volume_a/b instead of real trading volume.
#   2. backfill-claims-from-chain.ts --resync — re-checks settled battles from
#      the last 60 days for new claimShares withdrawals (traders can claim any
#      time after settlement, so this has to keep re-checking, not just backfill once).
#
# Installed via com.wavewarz.statz.integrity.plist (see that file for
# install/uninstall commands).

set -uo pipefail
cd "/Users/samanthakinney/Statz App V2 WaveWarz"

SINCE=$(date -v-60d +%Y-%m-%d 2>/dev/null || date -d "60 days ago" +%Y-%m-%d)

echo "===== $(date) — nightly integrity check ====="

echo "--- volume fix (auto-detect corruption pattern) ---"
npx tsx scripts/fix-volume-from-chain.ts

echo "--- claims resync (since $SINCE) ---"
npx tsx scripts/backfill-claims-from-chain.ts --resync --since="$SINCE"

echo "===== $(date) — done ====="
