# XO run notes (factual, 19 Nov 2026)

These are factual notes from landing the XO contribute transaction, for reference only. They are not the bounty
feedback; that stays hand-written in [XO-FEEDBACK.md](XO-FEEDBACK.md).

**Environment**
- Node 24, `@xo-cash/engine` 0.1.1-next.18029697917, `@xo-cash/state` IndexedDB storage (indexeddbshim over
  sqlite3), chipnet.
- `npm ci` fails at `websql-configurable → better-sqlite3`: its bundled node-gyp imports `distutils`, which Python 3.12+
  removed. `npm ci --ignore-scripts` plus `npm rebuild sqlite3 --ignore-scripts=false` works.
- This box's egress only allows HTTP(S), so `wss://chipnet.*:50004` fails the TLS handshake. `xo/electrum-relay-shim.mjs`
  serves Electrum on `ws://127.0.0.1:50993`. It forwards to Torc's `/api/chain` relay and emulates `headers`,
  `scripthash` and `transaction` subscriptions by polling. The engine takes it through `electrumServers:
  [{ electrumSocket: new ElectrumWebSocket(host, { port, encrypted: false }), blockchain: chipnet }]`.
- The shim must echo the client's requested protocol version in `server.version`. If it doesn't, `@electrum-cash/network`
  disconnects with a generic "Failed to connect".
- The relay does not allow `blockchain.transaction.get_merkle`, so the engine logs
  `Failed to process transaction update: AggregateError`: it cannot SPV-verify confirmations. Tracking, signing and
  broadcast still work. Adding `get_merkle` to `RELAY_METHODS` would remove the noise.

**Path to the successful transaction**
1. Ran the committed runner, which used the `inputIdentifier` fix. It failed with the same "Operation not valid with the
   current stack size" as before, because `listMissingRequirements` showed all 3 inputs unsigned. Cause: the engine
   had tracked no UTXOs (`listUnspentOutputs` was `[]`). `resolveInvitationOutputLockingBytecode` only compiles; it
   does not store or subscribe the script hash.
2. Added `xo-runner.mjs track`. It appends `seatReceiveOutput` to the receiveSeat invitation, and the engine then
   tracked the seat NFT and the tPUSD UTXO.
3. `signInvitation(id)` without an index throws "merged input undefined". Signing each `listOwnInputIndexes`
   entry (1 and 2) works. The covenant input (0) is not the wallet's, so the circle role now appends its
   `unlockingBytecode` (`<0> <redeem>`, built by `make-job.ts` from the CashScript contract).
4. The next broadcast failed with `OP_EQUALVERIFY`. Output 0's locking bytecode was P2SH32 of
   `OP_HASH256 <h> OP_EQUAL`, i.e. wrapped twice, because `lockingType: p2sh` maps to Libauth `p2sh32`. Pointing the
   locking script at the redeem script (and `unlockContribute` at `<0>`) fixed it, and the template identifier
   changed to `3c611f6c…`.
5. A dry run (`XO_DRY_RUN=1`) and a decode against the source outputs matched the covenant's address. Then
   `executeAction` broadcast `140817f1…11a8`, which confirmed in block `0000000000004bc3…d10b`.
- Every failed broadcast left its UTXOs reserved. `xo-runner.mjs release` archives contribute invitations, which
  clears the reservations.
- The sandbox wallet behind the old XO Circle (`5443dec9…`) was gone. A fresh tPUSD mint and a fresh XO Circle were made
  with the dev key; the seat 2 NFT went to the local XO wallet's receiveSeat address.
- The engine's own `estimatedFeeSatoshis` was 960. The template's fixed `minerFeeSatoshis` of 1,600 is what was paid.

**blaze.xo.cash**
- A client-side dev wallet. You must create or choose an account (and its network) before any tab renders.
- Inspect (`/inspect-transaction`) takes a hex or txid plus a network, and has no URL parameter for a deep link. For
  this tx it showed SUCCESS, VALID, and one INFO finding: "Transaction is already known on chipnet".
- Invitation import (Invitations → paste JSON) needs the template imported on the same device first.
