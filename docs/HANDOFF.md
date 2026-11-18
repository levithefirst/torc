# HANDOFF: the steps a browser or a human must do

For the Torc bot (and Fluid). Everything else is automated. Numbered, copy-pasteable, in priority order.
Live site: **https://torc-brown.vercel.app** · Vercel project `torc` (team "levithefirst-1227's projects").

Status legend: ✅ done by Claude Code · ⏳ waiting on you · 🔒 needs Fluid's explicit OK first.

---

## 1. Chipnet faucet ✅ (no action)
The scripts funded themselves: chipnet.bch.ninja uses a proof-of-work challenge (no captcha), which
`npm run faucet -- <keyName> <sats>` solves. Nothing to do. If it ever starts showing a captcha:
1. Open https://chipnet.bch.ninja on the phone.
2. Paste the `bchtest:` address the script printed (only that address), request 2,000,000 sats.

## 2. Vercel ✅ (no action)
Project is imported and deploying from `levithefirst/torc` branch `claude/new-session-fodura` to production.
Env already set: `NEXT_PUBLIC_NETWORK=chipnet`, `NEXT_PUBLIC_REPO_URL`, `DEMO_SEED` (sensitive), `CRON_SECRET` (sensitive).
Vercel Hobby crons only run once a day, so the 15-minute "tick" runs from GitHub Actions instead:
1. GitHub → levithefirst/torc → Settings → Secrets and variables → Actions → New repository secret.
2. Name `CRON_SECRET`. Value: the same value as Vercel's `CRON_SECRET` (Vercel → torc → Settings →
   Environment Variables → CRON_SECRET is write-only; if you cannot read it, set a NEW random value in
   BOTH places: Vercel first, then GitHub, then redeploy).
3. Done. `.github/workflows/tick.yml` calls `GET /api/demo/tick` every 15 minutes with it.

## 3. 🔒 MAINNET (blocked on Fluid's explicit OK)
Everything is built and tested; mainnet is switched on by env alone. When Fluid says yes:
1. Tell Claude Code: "mainnet approved". It runs `NETWORK=mainnet npm run keys:new -- treasury` and prints ONE
   `bitcoincash:q…` THROWAWAY address.
2. From any wallet, send **0.005 to 0.01 BCH (~$1–2)** to that printed address only.
3. 🔒 In Vercel, set a NEW `DEMO_SEED` for the mainnet deployment (32+ random characters, typed or generated on
   the phone, never pasted into chat). This rotates the server's demo seat keys so the chipnet seed is never
   used on mainnet.
4. Tell Claude Code "funded". It then runs, in order (one command each, already written):
   `NETWORK=mainnet npm run fund:seats -- --to <3 seat addresses from /api/demo/seats> --sats 30000 --tokens 0`
   `NETWORK=mainnet npm run circle:create -- --name "Lagos Market Circle" --mode bch --contribution 2000 --period 86400 --members <the 3 addresses> --names Ade,Bisi,Chidi`
   and sets `NEXT_PUBLIC_NETWORK=mainnet` + `NEXT_PUBLIC_DEMO_CIRCLE=<deployments/mainnet.json>` on Vercel.
5. Optional, also 🔒: to run a PUSD circle instead of BCH mode, get ~1 PUSD into the same throwaway address
   (Claude Code never buys PUSD). Then use `--mode token --contribution 10` (= 0.10 PUSD).

## 4. ⏳ Real wallet test on the Pixel 7 (chipnet)
1. Install Selene (selene.cash) on the Pixel. Settings → network → Chipnet. Get test coins: open
   https://chipnet.bch.ninja, paste Selene's receive address, request 100,000 sats.
2. On the phone open https://torc-brown.vercel.app/new → **Connect wallet** → in Selene scan or open the
   WizardConnect link. Approve the connection.
3. Tap **Use my address for every seat**, Asset **BCH (sats)**, amount 2000, round length 10 minutes, **Create circle**,
   approve in Selene. (If it asks first for "Prepare a coin", approve that too.)
4. On the circle page tap **Contribute** under each seat and approve each one.
5. Report back to Claude Code: which steps worked, the txids shown, and any error text verbatim.
6. Repeat 2–4 with Paytaca if it offers WizardConnect (Settings → Connected apps / WizardConnect), else skip.

## 5. ⏳ The deck (Widget Factory template)
1. Open https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk → File → Make a copy.
2. Fill it slide by slide from docs/DECK.md (≤ 8 slides). Use the live txids listed there.
3. Share → "Anyone with the link can view" → copy link.
4. Vercel → torc → Settings → Environment Variables → `NEXT_PUBLIC_DECK_URL` = that link (Production) → Redeploy.

## 6. ⏳ Donation / vote address (EMBER2026 Community-Choice tokens land here)
1. In Selene or Paytaca (mainnet), copy a **token-aware** receive address (`bitcoincash:z…`). Use a throwaway
   wallet/account, not a main one.
2. Vercel → `NEXT_PUBLIC_DONATION_ADDRESS` = that address → Redeploy. The banner shows it with copy + QR.

## 7. Logo files ✅ (no action)
`public/brand/torc-icon-gold-on-ink.png` and `torc-logo-board.png` are in the repo; the SVG marks
(`torc-mark*.svg`, `torc-lockup.svg`) were redrawn from them by `tools/make_mark.py`. To replace the mark, drop a new
`public/brand/torc-mark.svg` (viewBox 0 0 64 64) and re-run `python3 tools/make_mark.py` only if you change the geometry.

## 8. ⏳ Video (2:00, Pixel 7 screen recorder)
Follow docs/DEMO-SCRIPT.md shot by shot. Record at https://torc-brown.vercel.app, portrait.
Pixel: swipe down twice → Screen record → "Record audio: Microphone" → Start. Upload is Fluid's call.

## 9. Fluid only (Claude Code does none of these)
- Hand-write docs/XO-FEEDBACK.md (~500 words, your own words: the sponsor rejects AI-written feedback).
- OK to make the repo public.
- OK to submit the BUIDL on DoraHacks (draft in docs/SUBMISSION.md).
- OK to post the Telegram check-in and X build posts.
