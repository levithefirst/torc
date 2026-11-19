#!/usr/bin/env bash
# 10 runs of the judge-spec timing tests (2: time to first state, 3: time to SEEN 0-conf after the click)
# against production. If the site says "Next step available in N s" (demo cooldown or claim not yet open on
# chain time), the run waits N+5 s and tries again (up to 4 attempts), so every run measures a real broadcast.
# Appends one JSON line per run to $OUT, keeping the waits it saw.
set -u
BASE_URL="${BASE_URL:-https://torc-brown.vercel.app}"
OUT=${OUT:-docs/runs/latency-runs.jsonl}
LOGDIR=${LOGDIR:-/tmp}
mkdir -p "$(dirname "$OUT")" "$LOGDIR"
for i in $(seq 1 "${RUNS:-10}"); do
  waits=""
  for a in 1 2 3 4; do
    rm -f test-results/judge-timings.jsonl
    WS_BLOCKED=1 BASE_URL="$BASE_URL" npx playwright test --project=desktop -g "live circle from the chain|Run the next step live" --reporter=line > "$LOGDIR/latency-run-$i-$a.log" 2>&1
    status=$?
    line=$(python3 - "$i" "$status" "$a" "$waits" <<'PY'
import json, os, sys
run, status, attempt, waits = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
p = 'test-results/judge-timings.jsonl'
rows = [json.loads(l) for l in open(p)] if os.path.exists(p) else []
r = {'run': run, 'exit': status, 'attempt': attempt, 'waits_before': [w for w in waits.split('|') if w]}
for x in rows:
    if x['test'] == 'time-to-state': r['state_ms'] = x['ms']; r['at'] = x['at']
    if x['test'] == 'time-to-0conf': r['zeroconf_ms'] = x['ms']; r['outcome'] = x.get('kind'); r['txid'] = x.get('txid'); r['wait'] = x.get('text')
print(json.dumps(r))
PY
)
    secs=$(printf '%s' "$line" | python3 -c "import json,re,sys;r=json.load(sys.stdin);m=re.search(r'in (\d+) s',r.get('wait') or '');print(m.group(1) if r.get('outcome')=='wait' and m else '')")
    if [ -n "$secs" ] && [ "$a" -lt 4 ]; then
      waits="$waits|$(printf '%s' "$line" | python3 -c "import json,sys;print(json.load(sys.stdin)['wait'])")"
      echo "run $i attempt $a: wait ${secs}s"
      sleep $((secs + 5))
      continue
    fi
    echo "$line" >> "$OUT"
    break
  done
  echo "run $i exit $status"
  [ "$i" -lt "${RUNS:-10}" ] && sleep 65
done
echo DONE
