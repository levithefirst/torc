# Latency (production, 10 runs)

Measured on 19 Nov 2026, 14:51 to 15:12 UTC, against https://torc-brown.vercel.app (chipnet) with the judge spec
(`tests/judge.spec.ts`, desktop project 1440×900, headless Chromium), driven by `scripts/latency-runs.sh`.
Raw rows: [`runs/latency-runs.jsonl`](runs/latency-runs.jsonl) (the 10 runs) and
[`runs/latency-topup.jsonl`](runs/latency-topup.jsonl) (extra runs until 10 clicks had broadcast).

- **Time to state** (test 2): from navigation to the ring, turn label, pot and a real tx link on screen, with no wallet.
- **Time to SEEN 0-conf** (test 3): from the click on "Run the next step live" to the row for *that click's own
  txid* (read from the `/api/demo/tick` response) showing SEEN in the feed.

## Results

| | n | Median | Min | Max |
|---|---|---|---|---|
| Time to state | 10 | **1,183 ms** | 1,005 ms | 2,218 ms |
| Time to SEEN 0-conf | 10 broadcasts | **2,406 ms** | 1,880 ms | 3,292 ms |

All 18 page loads (runs plus top-ups) had a median time to state of 1,177 ms.

### The 10 runs

| Run | Time to state | Click outcome | Time to SEEN | txid |
|---|---|---|---|---|
| 1 | 1,175 ms | seen (2nd try, after "Next step available in 38 s") | 3,162 ms | `9795bb5a…` |
| 2 | 1,005 ms | seen | 2,364 ms | `ed1534ea…` |
| 3 | 1,125 ms | wait: payout opens in ~5 min of chain time | n/a | |
| 4 | 1,080 ms | wait: same | n/a | |
| 5 | 1,303 ms | wait: same | n/a | |
| 6 | 1,191 ms | wait: ~4 min | n/a | |
| 7 | 1,089 ms | wait: ~2 min | n/a | |
| 8 | 2,218 ms | seen | 3,202 ms | `ac66b185…` |
| 9 | 1,249 ms | seen | 1,880 ms | `ecbb448b…` |
| 10 | 1,197 ms | seen | 2,761 ms | `d3bd1cc8…` |

Top-up broadcasts (to reach 10): 2,448 · 3,292 · 1,898 · 2,248 · 2,154 ms
(`42aee25e…`, `fd0593d1…`, `fea6be4f…`, `6858c220…`, `7af67210…`); three more top-up clicks hit the same payout wait.
All 10 broadcast txids are distinct.

## Reading the numbers

- **Waits are the product working.** The demo button does the circle's next due step. When that step is a payout,
  the covenant refuses it until the chain's median-time-past passes `roundStart + period`, and MTP moves only when
  blocks arrive. The page then says so ("Payout opens when the chain clock passes …") instead of broadcasting a tx
  that would be rejected. A 60 s per-instance cooldown on the button gives the other kind of wait.
- **This is an upper bound for the live feed.** The measuring sandbox blocks WebSockets, so the page used its
  "live via server" HTTPS polling fallback instead of Electrum over WSS. A normal browser on WSS was not measured here.
- The click-to-SEEN time includes building and signing the tx in a Vercel function, broadcasting it to every
  configured Electrum server, and the page picking it up.

## Earlier passes (kept, not used above)

- [`runs/latency-runs-v1.jsonl`](runs/latency-runs-v1.jsonl): first pass. 8 of 10 clicks hit a wait because the
  harness did not wait out the cooldown; 2 broadcasts at 1,400 and 1,384 ms.
- [`runs/latency-runs-v2-stale-match.jsonl`](runs/latency-runs-v2-stale-match.jsonl): **invalid for 0-conf.** Test 3
  then treated any row missing from the first render as new, so it matched txs this click had not sent (five runs
  report the same txid in 55 to 191 ms). Fixed in test 3 before the pass above; see docs/JUDGE-SPEC.md.
