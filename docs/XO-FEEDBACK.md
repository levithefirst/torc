# XO feedback

PLACEHOLDER — Fluid writes ~500 words of personal feedback on building with XO here, by hand. AI-written feedback is rejected by the sponsor. Do not generate this text.

---

## Factual notes for reference (not the feedback)

Recorded by Claude Code while building `xo/torc-contribute.template.json`, 18–19 Nov 2026. Read them if useful; write the feedback in your own words.

**What was used**
- `@xo-cash/engine` 0.1.1-next.18029697917 (`next`; `latest` 0.0.1 is stale), `@xo-cash/templates` 0.0.12, `@xo-cash/state` 0.0.5, `@xo-cash/utils` `parseTemplate` for offline validation.
- Engine run in a throwaway Vercel Sandbox VM on Node 24, chipnet, mnemonic generated inside the VM.
- Flow used: `Engine.create` → `importTemplate` → `createInvitation(receiveSeat)` → `resolveInvitationOutputLockingBytecode` (seat address) → fund it → `createInvitation(contribute)` → `joinInvitationRole` → `appendInvitation` (variables, then inputs by outpoint, then outputs, then `transactionLocktime`/`transactionVersion`) → `signInvitation` → `executeAction({ broadcastTransaction: true })`.

**What broke or surprised**
- `StorageType.SQLITE` in `@xo-cash/state` 0.0.5 is incomplete (`listScriptHashes is not a function` inside `Engine.create`). Forcing `state@0.0.6` fails differently (`this[#storage].on is not a function`). `StorageType.INDEXEDDB` works in Node because it uses `indexeddbshim` over `sqlite3`.
- `npm` blocks `sqlite3`'s install script by default (newer npm `allowScripts`); it needs `npm rebuild sqlite3 --ignore-scripts=false`.
- The engine README shows `Engine.create(mnemonic, options)`; the playground example in the repo shows a different signature with an Electrum client argument.
- Playground uses `appendInvitation(id, { locktime, version })`; the installed engine requires `transactionLocktime` / `transactionVersion` (error: `AppendInvitationParametersEmptyError`).
- `createInvitation` returns a `StoredInvitation` wrapper; the id is at `.invitation.invitationIdentifier`, not `.invitationIdentifier` as in the playground.
- Passing both `roleIdentifier` and `intent.role` throws `InvitationRoleDuplicatedError`.
- Outputs locked to a template locking script need secrets generated *for that invitation*; a key from another invitation (or from `generateLockingBytecodeFromDefaultPolicy`) is rejected with `LockingScriptSecretsNotFoundError`. Spends of tracked outputs do pick up the keys of the invitation that created the address. Workaround: send outputs back via a `locking_script` variable.
- `generateLockingBytecodeFromDefaultPolicy('address')` needs `setDefaultPolicies` first (clear error, but not in the README).
- **Chipnet header sync:** `@electrum-cash/application` (checkpoint 0.7.2) rejects chipnet header 332451 ("claims target 486604799, expected 437753688"), i.e. a minimum-difficulty block, so the engine logs "Could not validate a block header … ahead of the current checkpoint" and never tracks new UTXOs. Worked around in the sandbox with a one-line patch that accepts headers claiming exactly the network's minimum-difficulty target when `allowMinimumDifficultyBlocks` is true (`xo/patch-chipnet-headers.mjs`).
- `stop()` ends with an unhandled `AggregateError: All promises were rejected` from Electrum teardown.

**Docs that were missing**
- No reference for invitation API parameter names; the blog "Writing Templates" post is the only field reference.
- Nothing on how a dapp/service supplies a UTXO it does not own (covenant input) besides appending an outpoint.
- Nothing on selecting a wallet UTXO by token category or NFT commitment.
- blaze.xo.cash is a client-rendered app with no text explaining how a transaction becomes inspectable.
- `api.html` on stack.xo.cash returns 404.

**What worked well**
- `parseTemplate` validated the template offline on the first try and the schema errors are precise.
- CashAssembly evaluations (`$(...)`) made it possible to compute the covenant's next state commitment inside the template.
- The engine compiled the real 482-byte TorcCircle redeem script from template variables.
