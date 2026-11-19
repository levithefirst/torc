import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import metrics from '../../../docs/metrics.json' with { type: 'json' };
import { BRAND_NAME, PITCH } from '@/brand';
import { DEMO } from '@/lib/app/demo';
import { getSnapshot } from '@/lib/server/chain';
import { DECK_URL, NETWORK, REPO_URL, explorerTx } from '@/lib/chain/config';

export const metadata = { title: 'Deck' };
// Re-read the live circle at most every 5 minutes; the rest is fixed at build time.
export const revalidate = 300;

const SITE = 'https://torc-cash.vercel.app';
// BCH price used for the dollar figures (CoinGecko, 18 Nov 2026), as in the README.
const BCH_USD = 208.25;
const usd = (sats: number) => `$${((sats * BCH_USD) / 1e8).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;

/** Medians from docs/LATENCY.md (10 production runs), read at build time so the deck never drifts. */
function latency() {
  try {
    const md = readFileSync(join(process.cwd(), 'docs/LATENCY.md'), 'utf8');
    const state = md.match(/Time to state \| \d+ \| \*\*([\d,]+) ms\*\*/)?.[1];
    const seen = md.match(/Time to SEEN 0-conf \| \d+ broadcasts \| \*\*([\d,]+) ms\*\*/)?.[1];
    return { state: state ?? '1,183', seen: seen ?? '2,406' };
  } catch {
    return { state: '1,183', seen: '2,406' };
  }
}

// Real-wallet test: Paytaca browser extension over WizardConnect, chipnet, 19 Nov 2026.
const WALLET_TEST = [
  { what: 'Create a 3-seat circle', txid: 'a512ff9c80783b14a1fdbdf8ea7f7e65d6ef223463fec8a9a29fe1309fb936bf' },
  { what: 'Seat 1 pays 2,000 sats', txid: '26ea2d72f1afbb105bafb99da2be3b100107722eeabec13298ae0e993ab285e0' },
  { what: 'Seat 3 pays 2,000 sats', txid: 'e32be41d17d2a82a595df90d4552e6e1519e261c8312391b3025936f4d94f2ea' },
  { what: 'Seat 2 pays 2,000 sats', txid: 'ffe74822eed7fe29996a155cf9bb817da50e3d67b832913898a3f8f999980aa3' },
];
const CLI_CIRCLE_PAYOUTS = 2; // docs/DEPLOYMENTS.md, the CLI-run circle

function Slide({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section
      data-testid="deck-slide"
      aria-label={`Slide ${n}: ${title}`}
      className="deck-slide flex min-h-[min(80vh,620px)] flex-col rounded-[var(--radius)] border border-border-subtle bg-surface p-6 sm:p-10"
    >
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <span className="num text-[12px] text-text-2">{n} / 8</span>
      </div>
      <div className="grid flex-1 content-start gap-4 text-[15px] leading-relaxed text-text-2 sm:text-base">{children}</div>
    </section>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-text">{children}</b>;
const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-[var(--radius)] border border-border-subtle p-3">
    <div className="num text-2xl font-semibold text-text">{value}</div>
    <div className="text-[13px] text-text-2">{label}</div>
  </div>
);

export default async function Deck() {
  const lat = latency();
  const t3 = metrics['token-3'];
  const t5 = metrics['token-5'];
  const qr = await QRCode.toString(SITE, { type: 'svg', margin: 1, color: { dark: '#100E0B', light: '#FBF9F5' } });
  const live = DEMO ? await getSnapshot(DEMO.params, 4000) : null;
  const snap = live?.snap ?? null;
  const demoPayouts = snap?.state.round ?? null;
  const demoTxs = snap?.historyCount ?? null;
  const externalDeck = DECK_URL.startsWith('http');

  return (
    <article className="grid gap-6 py-6" data-testid="deck">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">{BRAND_NAME} · BCH BLAZE 2026</h1>
        <p className="text-[13px] text-text-2">
          Use the arrow keys or scroll. {externalDeck && <a className="text-accent-text underline" href={DECK_URL}>Open the Google Slides version</a>}
        </p>
      </header>

      <Slide n={1} title="Savings circles run on trust in one person">
        <p className="text-lg text-text sm:text-2xl">{PITCH}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Rotating savings circles are a global habit: <B>tandas</B> in Mexico, <B>hui</B> in China, <B>chit funds</B> in India, <B>susu</B> in Ghana, <B>ajo</B> and <B>esusu</B> in Nigeria, where Torc started. Hundreds of millions of people save this way, often without a bank.</li>
          <li>Every member pays a fixed amount each round. Each round, one member takes the whole pot.</li>
          <li>The collector holds everyone’s money between rounds. When the collector disappears, so does the pot.</li>
        </ul>
      </Slide>

      <Slide n={2} title={`${BRAND_NAME}: the covenant holds the pot`}>
        <ul className="list-disc space-y-1 pl-5">
          <li>A <B>Bitcoin Cash covenant</B> holds the money. 3 to 5 seats, a fixed amount in PUSD (a dollar token) or BCH, a fixed round length.</li>
          <li>Each round the whole pot goes to the seat whose turn it is, <B>and only to them</B>. No collector, no admin key, no upgrade path.</li>
          <li>A seat is an NFT in the member’s own wallet. Whoever holds it is that seat, so a seat can be handed on.</li>
          <li>Anyone can open a circle’s page from its address alone: the parameters are written on chain at creation.</li>
        </ul>
      </Slide>

      <Slide n={3} title="Live demo">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_200px]">
          <div className="grid gap-3">
            <p>
              <a className="text-xl font-semibold text-accent-text underline" href={SITE}>torc-cash.vercel.app</a>
            </p>
            <p>The page opens on a real circle on {NETWORK}. One click on <B>Run the next step live</B> signs and broadcasts its next real transaction (a payment, or the payout) with a demo seat key on the server. No wallet needed.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat value={`${lat.state} ms`} label="median time to a live circle on screen" />
              <Stat value={`${lat.seen} ms`} label="median click to SEEN 0-conf" />
              {demoPayouts !== null && <Stat value={String(demoPayouts)} label={`payouts made by the demo circle${demoTxs ? ` (${demoTxs} txs)` : ''}`} />}
            </div>
            <p className="text-[13px]">Production, 10 runs, 19 Nov 2026 (docs/LATENCY.md). The demo circle uses 10-minute test rounds so a full cycle fits in a visit.</p>
          </div>
          <div className="mx-auto w-[180px] overflow-hidden rounded bg-[#FBF9F5] p-2" aria-label="QR code for torc-cash.vercel.app" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </Slide>

      <Slide n={4} title="How the covenant works">
        <ol className="list-decimal space-y-1 pl-5">
          <li><B>Start:</B> one transaction mints a state NFT into the covenant (round, round start, who has paid) and one member NFT per seat. No minting key survives, so no extra seat can ever exist.</li>
          <li><B>contribute():</B> sets your seat’s bit and locks exactly one contribution in the ring. A seat can pay once per round.</li>
          <li><B>claim():</B> only when every seat has paid and the round time has passed, and only to the turn seat’s own address, the whole pot, nothing skimmed.</li>
          <li><B>pool():</B> pooled money can only leave inside a valid claim.</li>
        </ol>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={`${t3.redeemScriptBytes} B`} label="covenant script" />
          <Stat value={`${t3.contributeTxBytes.toLocaleString('en-US')} B`} label="contribute tx" />
          <Stat value={`${t3.claimTxBytes.toLocaleString('en-US')} B`} label="claim tx, 3 seats" />
          <Stat value="24 / 14" label="tests / attack cases the covenant must reject" />
        </div>
        <p className="text-[13px]">
          Source: <a className="text-accent-text underline" href={`${REPO_URL}/blob/main/contracts/TorcCircle.cash`}>contracts/TorcCircle.cash</a> (CashScript 0.14, BCH 2025 opcodes only, so every wallet VM can run it).
        </p>
      </Slide>

      <Slide n={5} title="Why Bitcoin Cash">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={usd(t3.contributeFeeSats)} label={`per contribution (${t3.contributeFeeSats.toLocaleString('en-US')} sats)`} />
          <Stat value={usd(t3.perRoundFeeSats)} label={`a full 3-seat round (${t3.perRoundFeeSats.toLocaleString('en-US')} sats)`} />
          <Stat value={usd(t5.perRoundFeeSats)} label={`a full 5-seat round (${t5.perRoundFeeSats.toLocaleString('en-US')} sats)`} />
          <Stat value="~2 s" label="until a payment is visible (0-conf)" />
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li><B>CashTokens</B> carry the seats, the state and the dollar (PUSD) natively: no bridge, no wrapped asset.</li>
          <li>Fees small enough that even a $1 contribution makes sense. Fees at 1 sat/byte, BCH at ${BCH_USD} (18 Nov 2026).</li>
          <li>0-conf lets a market trader see their payment land while they are still at the stall.</li>
        </ul>
      </Slide>

      <Slide n={6} title="If someone doesn’t pay">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-semibold text-text">Today (v1)</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>The payout needs every seat paid, so a missing payment pauses the round. Nobody can take the pot early or run with it.</li>
              <li>Money already paid in stays locked in the covenant until the missing seat pays. There is no deadline, so a late payment still unlocks it.</li>
              <li>A member who wants out can hand their seat NFT to someone who will keep paying.</li>
              <li><B>Not solved yet:</B> a seat that never pays leaves that round’s money stuck, and a member who took the pot can stop paying.</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-text">v2 design</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li><B>Timeout refund:</B> after the deadline plus a grace period, each member who paid takes their own contribution back with their seat NFT.</li>
              <li><B>Bond:</B> each seat locks a bond on joining and loses it to the members who paid if it misses a round.</li>
              <li><B>Payout bond:</B> the covenant keeps back what you still owe when you take the pot and releases it as you pay.</li>
              <li>All covenant rules, still no admin key.</li>
            </ul>
          </div>
        </div>
      </Slide>

      <Slide n={7} title="What runs today (chipnet)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value="4" label="circles created" />
          <Stat value={demoPayouts !== null ? String(demoPayouts + CLI_CIRCLE_PAYOUTS) : '8+'} label="payouts made by covenants" />
          <Stat value="1" label="seat transferred on chain, then paid in by its new holder" />
          <Stat value="1" label="contribution through the XO engine" />
        </div>
        <div>
          <p className="mb-1"><B>Real-wallet test</B>, Paytaca browser extension over WizardConnect, 19 Nov 2026: create a circle, then all 3 seats pay.</p>
          <ul className="grid gap-0.5 text-[13px]">
            {WALLET_TEST.map((t) => (
              <li key={t.txid}>{t.what}: <a className="num text-accent-text underline" href={explorerTx(t.txid, 'chipnet')}>{t.txid.slice(0, 10)}…</a></li>
            ))}
          </ul>
          <p className="mt-1 text-[13px]">The payout from a real wallet and a Selene test are still to do. Mainnet is pending a funded treasury.</p>
        </div>
      </Slide>

      <Slide n={8} title="Business model and ask">
        <ul className="list-disc space-y-1 pl-5">
          <li><B>Free protocol.</B> Revenue from a small creation fee in the app, premium circles (reminders, bigger circles, the v2 bond), and white-label circles for cooperatives, church and market associations, and diaspora groups.</li>
          <li><B>Distribution:</B> an existing circle moves as a whole group, so one sign-up brings 3 to 5 members.</li>
          <li><B>Team:</B> Fluid (builder). Built during BCH BLAZE 2026, 18 to 22 Nov.</li>
          <li><B>Ask:</B> a pilot with real circles in PUSD, starting with the ajo groups Torc came from, and intros to wallet teams (Selene, Paytaca) for a native “Circles” tab.</li>
        </ul>
        <p className="mt-auto text-[13px]">
          Code: <a className="text-accent-text underline" href={REPO_URL}>{REPO_URL.replace('https://', '')}</a> · Live: <a className="text-accent-text underline" href={SITE}>{SITE.replace('https://', '')}</a>
        </p>
      </Slide>

      <DeckKeys />
    </article>
  );
}

// Arrow keys / PageUp / PageDown jump between slides (tiny inline script; no client bundle needed).
function DeckKeys() {
  const js = `(function(){if(window.__deckKeys)return;window.__deckKeys=1;document.addEventListener('keydown',function(e){var k=e.key;if(['ArrowRight','ArrowDown','PageDown','ArrowLeft','ArrowUp','PageUp'].indexOf(k)<0)return;var s=[].slice.call(document.querySelectorAll('.deck-slide'));if(!s.length)return;var y=window.scrollY+80;var i=0;s.forEach(function(el,j){if(el.offsetTop<=y)i=j});var n=(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown')?Math.min(i+1,s.length-1):Math.max(i-1,0);e.preventDefault();s[n].scrollIntoView({behavior:'smooth',block:'start'})})})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
