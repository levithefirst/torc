# Demo button: worst-case cost

The site's "Run the next step live" signs the demo circle's next step with throwaway demo seat keys.
Could someone script it to drain those keys?

## What the covenant allows
- Money only moves seat -> covenant (`contribute()`) and covenant -> the turn seat (`claim()`). Every sat
  of contributions comes back to a demo seat, so a drainer can only burn **fees**.
- Each seat contributes once per round, so a round is at most 3 contributions + 1 claim.
- `claim()` requires `tx.time >= roundStart + 600` (median-time-past), and a claim sets `roundStart` to its
  own locktime. MTP tracks wall-clock time, so there are at most ~6 rounds per hour, however many requests
  or server instances are involved.

## Worst case (mainnet demo, BCH mode, 3 seats, 1 sat/byte; sizes from docs/metrics.json)
- Per round: 3 x 1,012 + 2,460 = **5,496 sats**
- Per hour: ~6 rounds = **~33,000 sats/hour** (~0.00033 BCH, about $0.07/hour at $208/BCH)
- Per day, if someone ran it nonstop: ~790,000 sats (~0.0079 BCH, about $1.65/day)
- Allow some margin for fast blocks: MTP can briefly advance faster than the wall clock.

## Extra limits in `/api/demo/tick`
- POST must come from the site itself (Origin = host). Scripts can fake this; it stops casual cross-site use.
- At most 4 unconfirmed covenant txs at once (one full round), read from the chain's mempool, so every
  server instance sees the same limit with no extra infrastructure.
- Per-instance: 60 s between steps (except the payout right after a round fills) and one broadcast in flight.
- Scheduled runs (`GET` with `CRON_SECRET`) skip the Origin and cooldown checks but leave an open payout for
  visitors for up to 6 h of chain time.
