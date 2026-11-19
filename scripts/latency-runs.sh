#!/usr/bin/env bash
# 10 runs of the judge-spec timing tests (2: time to first state, 3: time to SEEN 0-conf after the click)
# against production, spaced past the demo tick's 60 s cooldown. Appends to test-results/latency-runs.jsonl.
set -u
BASE_URL="${BASE_URL:-https://torc-brown.vercel.app}"
OUT=test-results/latency-runs.jsonl
mkdir -p test-results
for i in $(seq 1 "${RUNS:-10}"); do
  rm -f test-results/judge-timings.jsonl
  WS_BLOCKED=1 BASE_URL="$BASE_URL" npx playwright test --project=desktop -g "^(2|3)\." --reporter=line > "test-results/latency-run-$i.log" 2>&1
  status=$?
  python3 - "$i" "$status" >> "$OUT" <<'PY'
import json, sys
run, status = int(sys.argv[1]), int(sys.argv[2])
rows = [json.loads(l) for l in open('test-results/judge-timings.jsonl')] if __import__('os').path.exists('test-results/judge-timings.jsonl') else []
r = {'run': run, 'exit': status}
for x in rows:
    if x['test'] == 'time-to-state': r['state_ms'] = x['ms']; r['at'] = x['at']
    if x['test'] == 'time-to-0conf': r['zeroconf_ms'] = x['ms']; r['outcome'] = x.get('kind'); r['txid'] = x.get('txid'); r['wait'] = x.get('text')
print(json.dumps(r))
PY
  echo "run $i exit $status"
  [ "$i" -lt "${RUNS:-10}" ] && sleep 70
done
echo DONE
