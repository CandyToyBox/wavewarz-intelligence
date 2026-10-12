#!/bin/sh
# Waits for the chained trades+claims backfill to finish, then prints a summary.
while pgrep -f "backfill-(trades|claims)-from-chain" > /dev/null; do sleep 300; done
echo "=================================================================="
echo "BACKFILL CHAIN COMPLETE — $(date)"
echo "=================================================================="
echo "--- trades run 2 tail ---"
tail -7 ops/logs/backfill-trades-force2-*.log
echo "--- claims resync 2 tail ---"
tail -7 ops/logs/backfill-claims-resync2-*.log 2>/dev/null || echo "(claims log not found)"
