# SDK and consensus notes

What was checked against the installed packages, their type definitions and live services
(18 Nov 2026), and where reality differed from the build prompt.

## Versions (pinned exactly in package.json)

| Package | Pinned | Notes |
|---|---|---|
| cashscript / cashc / @cashscript/utils | 0.14.0 | `latest` = 0.14.0. cashscript itself depends on `@bitauth/libauth ^3.1.0-next.8` (installed nested). |
| @bitauth/libauth | 3.0.0 | Latest stable. 3.1.0-next.x is pre-release, so not bumped at top level. |
| mainnet-js | 4.0.0-next.13 | Installed as asked; not used at runtime. CashScript + Electrum cover everything Torc needs, so the bundle stays smaller. |
| @electrum-cash/network | 4.4.8 | Used directly (browser + server) for WSS, subscriptions and failover. |
| @wizardconnect/react / dapp | 0.2.7 / 0.2.8 | core resolves to 0.2.11. |
| @xo-cash/engine / templates | 0.1.1-next.18029697917 / 0.0.12 | `latest` engine (0.0.1) is stale, `next` used as the prompt said. |
| next / react / tailwindcss | 16.4.6 / 19.3.1 / 4.3.5 | App Router, Tailwind v4 `@theme`. |
| typescript | 5.9.3 | 7.0.x (the Go port) is `latest`, but Next 16 is built and tested against 5.x. Chose 5.9.3 on purpose. |
| vitest / @playwright/test | 5.1.1 / 1.63.0 | Playwright pinned to the version of the browser pre-installed in the build sandbox. |

## Consensus (mainnet as of today)

- **May 2026 "Layla" upgrade** (Loops `OP_BEGIN/OP_UNTIL`, Functions `OP_DEFINE/OP_INVOKE`, bitwise ops, P2S)
  is specified with BCHN v29 and, per CHIP-2024-12 (P2S), raises the **NFT commitment limit from 40 to 128 bytes**
  and the standard unlocking-bytecode limit from 1,650 to 10,000 bytes. CashScript 0.14 ships `VmTarget.BCH_2026_05`
  and the compiler accepts `for`/`while`/`<<`.
- **Torc does not depend on any of it.** The state commitment is 6 bytes, the member commitment 2 bytes (both
  fit the old 40-byte limit), the contracts use only BCH_2025_05 opcodes (no loops, no shifts: bit tests use a
  lookup table and integer division), and the largest unlocking bytecode (claim, 5 seats) is ~520 bytes, well
  under 1,650. So the covenant is valid on mainnet whether or not a given node, wallet or library has caught up
  with the 2026 rules. That was deliberate: wallets that simulate transactions with an older libauth still work.
- The chipnet faucet UI (chipnet.bch.ninja) still says "Up to 40 bytes" for commitments. Irrelevant to Torc.

## CashScript 0.14 (read from `node_modules/cashscript/dist/*.d.ts` and `cashc/dist`)

- `this.activeBytecode` is the **redeem script**, not the P2SH32 locking bytecode. Comparing an output's
  `lockingBytecode` to it always fails. Torc compares to `tx.inputs[this.activeInputIndex].lockingBytecode`
  instead (cheaper than `new LockingBytecodeP2SH32(hash256(this.activeBytecode))`). Caught by the first test run.
- `tokenCategory` introspection returns the category in serialized (reversed) byte order; constructor args are
  therefore passed reversed (`categoryArg()` in `src/lib/torc/circle.ts`). libauth's `decodeTransaction` and
  Electrum's `token_data.category` use display order.
- `tx.time >= x` compiles to `OP_CHECKLOCKTIMEVERIFY`; `TransactionBuilder` sets non-final sequence numbers by
  default, so `setLocktime()` is all a claim needs.
- `TransactionBuilder.send()` evaluates every covenant input locally first and throws with the failing
  `require` message, then MockNetworkProvider validates against the real VM including token rules
  ("Transaction violates token validation"). The adversarial tests assert on those exact messages.
- `MockNetworkProvider` does not check timestamp locktimes against a clock. The covenant's own CLTV check
  still rejects a claim whose locktime is below `roundStart + period`, which is what the test asserts.
- `generateWcTransactionObject({ broadcast, userPrompt })` + `placeholderP2PKHUnlocker(address)` build the
  BCH WalletConnect transaction object that WizardConnect also uses.

## Time locks: median-time-past, not wall clock

A timestamp locktime is final only when it is **strictly below** the median-time-past (MTP) of the last 11
blocks, which lags wall-clock time by roughly an hour. Torc's claim sets `locktime = MTP - 1` (MTP computed
from the last 11 headers via `blockchain.block.headers`) and stores that as the next `roundStart`, so each
round lasts at least `period` seconds **of chain time**. The UI says "payout opens in ~N min of chain time".
Block height would have been simpler to check but makes a "1 day" period depend on block luck; seconds map to
how ajo groups think ("every Saturday").

## Electrum

- Fulcrum's `blockchain.scripthash.listunspent` accepts `'include_tokens'` and returns `token_data`.
- Chipnet servers verified: `chipnet.bch.ninja` (wss 50004, Fulcrum, cashtokens + dsproof),
  `chipnet.imaginary.cash` (wss 50004). Mainnet defaults: `bch.imaginary.cash`, `electrum.imaginary.cash`,
  `bch.loping.net`.
- The build sandbox's egress only carries TLS on port 443, so Electrum WSS (50004) is unreachable from it.
  The app ships `/api/chain`, a whitelisted read + broadcast relay (no keys), and the CLI scripts accept
  `TORC_RELAY_URL` to use it. Browsers and Vercel functions talk to Electrum directly.

## WizardConnect (read from `@wizardconnect/*/dist/*.d.ts` and README)

- `useWizardConnect({ dappName, dappIcon, sessionKey })` → `{ state, manager, uri, qrUri, walletName, connect, disconnect }`.
  `dappName` is `BRAND_NAME`.
- Signing: `manager.signTransaction({ transaction, inputPaths })` where `transaction` is the BCH WalletConnect
  object and `inputPaths` is `[inputIndex, pathName, addressIndex][]` for **only** the inputs the wallet signs.
  Covenant inputs carry their own unlocking bytecode and are omitted.
- Nothing documents how a dapp finds which HD path/index owns a UTXO. Torc derives addresses from the xpubs the
  wallet shares in `wallet_ready` (`manager.getPubkey(0|1, i)`: receive 0..19, change 0..9), queries Electrum for
  each, and keeps a lockingBytecode → (path, index) map.
- The response carries `signedTransaction` hex; Torc broadcasts it itself (`broadcast: false`).
- Default relay: `wss://relay.riften.net`.

## XO

See docs/XO.md.

## Differences from the build prompt

- `this.activeBytecode` (see above) cannot be compared to output locking bytecode.
- BCH mode is a separate contract (`TorcCircleBch.cash`, 439-byte redeem script) rather than a mode flag:
  a runtime flag would add branches to every function of the token contract (486 bytes) and every claim
  carries the redeem script once per covenant input, so smaller scripts mean cheaper rounds.
- The state commitment layout is exactly as specified (6 bytes LE). The round counter is one byte, so a
  circle ends at round 255 (51 full cycles of 5 seats); `claim()` enforces `round < 255`.
- Contribution UTXOs carry exactly 1,000 sats in token mode (enforced), which partly pays the claim fee.
- Demo seat keys: instead of `DEMO_SEAT_WIFS`, the server derives them from `DEMO_SEED` (HMAC-SHA256), so
  the keys exist only inside the Vercel function. `DEMO_SEAT_WIFS` is still accepted.
- Vercel Hobby crons run at most daily, so the 15-minute tick is a GitHub Actions schedule instead (HANDOFF).
