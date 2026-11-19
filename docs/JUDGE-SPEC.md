# Judge spec results

`tests/judge.spec.ts` (Playwright 1.63) against **https://torc-cash.vercel.app**, projects mobile 360×780 (Pixel 7 UA, touch) and desktop 1440×900.

Run 2026-11-19 14:26 UTC, deployment of commit 863fe9e: **14 / 14 passed** (26.7 s).

| # | Check | mobile | desktop |
|---|---|---|---|
| 1 | Banner (deck, repo, donation) on /, /new, /circle/demo, /deck; no horizontal scroll | ✅ | ✅ |
| 2 | Ring, turn label, pot, ≥1 explorer txid within 10 s, no wallet, no click | ✅ 863 ms | ✅ 728 ms |
| 3 | Click "Run the next step live" → new row SEEN 0-conf within 10 s of the click | ✅ 2,025 ms | ✅ 2,933 ms |
| 4 | Every txid on the page resolves (`blockchain.transaction.get`) | ✅ | ✅ |
| 5 | No console errors, no overflow at 360 px, LCP < 2.5 s (desktop) | ✅ | ✅ LCP 200 ms |
| 6 | /new builds an unsigned 3-seat genesis with no wallet (dry run) | ✅ | ✅ |
| 7 | Electrum down (all WebSockets closed and /api/circle → 503): last known state still rendered and labelled | ✅ | ✅ |

Raw timings: `docs/runs/`. The run sets `WS_BLOCKED=1` because the build sandbox blocks Electrum WSS ports; that flag only ignores the
browser's "WebSocket connection failed" console message. On a normal network the page uses Electrum WSS directly.
Contract-level core loop (CI, MockNetworkProvider): one full contribute→claim cycle in ~4.5 s (< 10 s).

**Correction (19 Nov):** test 3 used to treat any feed row missing from the first render as "new". A stale
first render could make it match a tx that this click did not broadcast (seen in latency pass 2, kept as
`docs/runs/latency-runs-v2-stale-match.jsonl`). Test 3 now reads the txid from this click's
`/api/demo/tick` response and waits for that exact row to show SEEN. The 2,025 / 2,933 ms figures above came
from the old matcher; docs/LATENCY.md has the numbers from the fixed test.
