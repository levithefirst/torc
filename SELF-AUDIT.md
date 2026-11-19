# Self-audit

Three two-minute passes over https://torc-brown.vercel.app and this repo, each as one BLAZE judge,
on a 360 px phone viewport and on desktop. Every bug found is listed with what was done about it.
Scores are honest guesses, /10: Innovation · Design & usability · Technical strength · Business potential.

## Pass 1: Elliot Price (business)

*Looks for: a real user, a reason to come back, a way to make money, honest claims.*

- **+** The problem is stated in one sentence ("the collector holds everyone's money") and the product answers it on the first screen.
- **+** Cost is concrete and sourced: ~$0.003 per contribution, ~$0.014 per 3-seat round at BCH $208.25 (README).
- **+** Reason to come back exists: due date + payout date per seat with `.ics` downloads (member view).
- **−** No donation / vote address in the banner yet ("address coming soon"). → HANDOFF §6 (Fluid's own throwaway address; not something I should pick).
- **−** Deck link pointed to `/deck`, which 404'd. → **Fixed**: `/deck` now renders `docs/DECK.md` until the Widget Factory URL is set.
- **−** Business model only lives in the deck. → Kept there (DECK.md slide 6); the product page stays about the product.

Score before → after: 7 · 7 · 7 · **5 → 6** (deck page now exists; donation address still pending).

## Pass 2: Kallisti (Selene lead dev: wallet path, guest view, bugs)

*Looks for: does the guest view really work, does the wallet path work, anything broken.*

- **+** Guest view: ring, pot, feed and a real tx on screen in about 1.2 s with no wallet (median of 10 production runs, docs/LATENCY.md).
- **+** "Run the next step live" produces a real tx that shows SEEN 0-conf in a median 2.4 s (1.9–3.3 s over 10 broadcasts, docs/LATENCY.md), and the turn advances on payout.
- **+** Electrum down: the page keeps the last server-rendered state and says "as of HH:MM · reconnecting" (test 7, green on production).
- **−** **WizardConnect has not been tested against a real Selene yet.** The integration follows the package types (xpub discovery, placeholder P2PKH unlockers, `inputPaths`, broadcast by the dapp) but no device test has run. → HANDOFF §4 (Pixel test on chipnet). Stated plainly in README "Wallets".
- **−** `/new` showed two gold buttons (Connect and Create) before a wallet was connected. → **Fixed**: Create stays outlined until a wallet is connected.
- **−** Some of the CLI circle's txs stayed unconfirmed for ~20 h: they were broadcast through one Electrum node while a parent was still unconfirmed elsewhere, peers dropped them as orphans, and the node never re-announced them. → **Fixed**: the relay and the demo tick now broadcast to *every* configured Electrum server, and `npm run rebroadcast` re-sent the stuck chain parents-first.
- **−** Two members contributing at the same moment race for the same state UTXO; the loser's wallet tx is rejected. → Shown as an error with the node's message; retrying works. Not changed (inherent to a single-state covenant).
- **−** No BCH WalletConnect v2 path (Cashonize). → Listed as next in README.

Score before → after: 7 · **6 → 7** · 7 · 6.

## Pass 3: Sayoshi Nakamario (FundMe: covenant depth, "is this FundMe?")

*Looks for: real covenant logic, attack resistance, and whether it is just a crowdfund.*

- **+** It is not a crowdfund: no goal, no refund, no campaign owner. Money rotates to a different member each round, enforced on chain.
- **+** The rule that matters is enforced, not trusted: `claim()` pays exactly `contribution × seats` to *the spender of the turn seat's NFT* and nothing else leaves the covenant (`pool()` only moves inside a claim that advances the round).
- **+** 12 attack tests, each asserting the exact failing `require` or the consensus rule (see `tests/contract/attacks.test.ts`).
- **−** Defaults stall the circle forever. → By design for v1 (documented in README "What happens if someone doesn't pay"); bond NFTs are the v2 answer.
- **−** The genesis is not checked by any covenant: a creator could mint a state NFT with `roundStart` in the past so round 1 opens early. → Members can read the state before contributing (the app shows it); documented below.
- **−** "Fraction of a cent" was too vague. → README gives measured sizes and fees per contribution and per round.

Score before → after: **8** · 7 · **8** · 6.

## Covenant threat model

| Threat | What can happen | What Torc does |
|---|---|---|
| **Dust / donation sends to the covenant** | Anyone can send BCH or tokens to the covenant address. | Inert. The state is found by its mutable NFT; contributions by exact category + amount + no NFT. A stray UTXO with exactly the contribution amount could be used as one of the pooled inputs in a claim; the pot is still exactly `contribution × seats`, so the extra just stays for a later round. Nothing can be taken: `pool()` is limited to inputs 2..seats+1 of a round-advancing claim. |
| **Spending pooled money outside a claim** | Someone adds contribution UTXOs to a contribute tx to skim them. | `pool()` requires output 0 to advance the round (test "pooled money moving inside a contribute tx"). |
| **Extra pooled inputs in a claim** | Claimer adds a 4th contribution-shaped UTXO and pays it to themselves. | `pool()` rejects any input index above `seats + 1` (test "extra pooled UTXO in a claim"). |
| **Pot redirected or short** | Claim output 1 to another address, or less than the full pot. | `claim()` binds output 1 to input 1's locking bytecode and to exactly `contribution × seats` (two tests). |
| **Wrong seat / early / unpaid claim** | Claim by a non-turn seat, before the period, or with a seat unpaid. | `seat == round % seats`, `tx.time >= roundStart + period`, `paidMask == 2^seats − 1` (three tests). |
| **Double contribution** | A seat pays twice in a round. | Bit check `(paidMask / 2^seat) % 2 == 0` (test). |
| **Second state NFT / extra member NFT** | Mint a duplicate state or seat. | No minting NFT exists after genesis; output 0 must be the mutable state, so consensus allows no other new circle NFT ("violates token validation", two tests). |
| **State leaves the covenant** | Output 0 elsewhere. | Required back at the covenant's own locking bytecode with same sats (test). |
| **Stuck rounds** | A member never pays, or the turn seat never claims. | Circle stalls; funds stay locked and safe; nobody can take them. Social resolution or a seat sale (seat NFTs are transferable). v2: bond NFTs and an anyone-can-trigger payout. |
| **Member NFT sent to a burn address** | That seat can never pay or claim again. | Same as a stall. The UI warns before a seat transfer only by showing the destination; documented. |
| **Malleability** | Third parties change a txid. | BCH has no third-party malleability for these spends (Schnorr signatures, push-only and clean-stack rules); covenant unlocking bytecode is deterministic. |
| **Fee sniping / miner reordering** | A miner re-mines or reorders. | Outputs are fixed by the covenant; reordering cannot redirect value. Claims use a timestamp locktime that only makes the tx valid later, never earlier. |
| **MTP vs wall clock** | `tx.time` is checked against median-time-past, ~1 h behind wall clock. | Claim sets `locktime = MTP − 1` and stores it as the next `roundStart`; the UI says "payout opens in ~N of chain time". A "1 day" round is at least 1 day of chain time. |
| **Concurrent contributions** | Two members spend the same state UTXO at once. | One wins, the other is rejected and can retry. No loss. |
| **Creator-set genesis state** | `roundStart` or seat order chosen by the creator. | Visible on chain and in the app before anyone pays; members choose whether to join. |
| **Server keys** | The site's demo keys could be stolen. | They are throwaway chipnet demo seats derived from `DEMO_SEED` in Vercel's encrypted env and only ever hold demo funds. The chipnet seed value appeared once in a build-session transcript: rotate before any mainnet use (HANDOFF §3). |
| **Public relay abuse** | `/api/chain` relays broadcasts and reads. | Method whitelist, parameter size cap, no keys. Broadcasting is permissionless on BCH anyway. |

## Bugs found and status

| Bug | Status |
|---|---|
| `/deck` 404 (banner link) | Fixed (page added, covered by judge test 1) |
| Two gold buttons on `/new` before connect | Fixed |
| CLI-circle txs stuck in one mempool | Fixed (broadcast fan-out + `npm run rebroadcast`) |
| Vercel build broke on `better-sqlite3` from the XO engine's storage | Fixed (`vercel.json` installs with `--ignore-scripts`; the app never imports `@xo-cash/*`) |
| Latency harness lost its logs (Playwright cleans `test-results/`) | Fixed |
| Donation address missing | Open: HANDOFF §6 (Fluid) |
| Real-wallet (Selene/Paytaca) test not done | Open: HANDOFF §4 |
| Widget Factory deck not created | Open: HANDOFF §5 |
