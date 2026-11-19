# Demo video script (2:00)

Recorded on a Pixel 7 (screen recorder, portrait, mic on). Site: https://torc-brown.vercel.app.
No intro slide: the first frame is the live page. Voice-over below is 255 words.

| Time | Shot (what is on screen) | Caption on screen | Voice-over |
|---|---|---|---|
| 0:00–0:10 | Home page already loaded: the ring, "Round N · pays …", the feed with a real txid and a CONFIRMED badge. Slow scroll from ring to feed. | `Live from chipnet. Nothing here is mocked.` | "This is Torc, a savings circle running on Bitcoin Cash. Everything you see is read from the chain right now." |
| 0:10–0:30 | Stay on the ring. Tap the pot line so it is in frame. | `In an ajo, the collector holds the money.` | "Across West Africa and far beyond, people save in rotating circles: everyone pays in, one person takes the pot each round. The weak point is the collector, who holds everyone's money. Torc removes the collector." |
| 0:30–1:00 | Tap **Run the next step live**. The new row appears dashed: "SEEN · 0-conf" within ~2 s. If the next step is a payout, the gold turn marker steps one segment clockwise. | `A real transaction. Seen in ~2 seconds.` | "Watch. I tap once, a demo member pays in, and the transaction shows up seen in about two seconds, before any block. When every seat has paid and the round time has passed, the pot moves to exactly the seat whose turn it is, and the turn moves on." |
| 1:00–1:25 | Open GitHub → contracts/TorcCircle.cash at `claim()`; zoom on the 3 lines: `seat == round % seats`, `paidMask == full`, `outputs[1].lockingBytecode == inputs[1].lockingBytecode`. Then DEPLOYMENTS.md, the "transfer" row (Chidi → Dayo). | `The rule, in three lines.` | "The rule is three lines of CashScript: only the turn seat, only when everyone paid, and the pot can only go back to that seat's own address. Seats are NFTs, so a seat can even be sold: here Chidi's seat moved to Dayo, and Dayo paid and claimed." |
| 1:25–1:45 | /new on the phone → Connect wallet (Selene QR) → Use my address for every seat → Create circle → approve in Selene → circle page → Contribute. | `Any judge: make your own circle.` | "You can make your own: connect Selene, put your address in every seat, create the circle, and contribute. That is a real covenant transaction from your own wallet, for a fraction of a cent." |
| 1:45–2:00 | Back to home, ring in frame, banner visible (Deck · GitHub · Donate). | `Torc · github.com/levithefirst/torc · deck in the banner` | "In an ajo, the collector holds everyone's money. In Torc, nobody does. The ring pays whoever's turn it is, and only them." |

Recording tips: Pixel quick settings → Screen record → "Record audio: Microphone". Do two takes of 0:30–1:00 (the
button has a 60-second cooldown per server instance; if it says "available in N s", wait and tap again).
