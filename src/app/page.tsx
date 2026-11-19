import { DEMO } from '@/lib/app/demo';
import { getSnapshot } from '@/lib/server/chain';
import { JudgeMode } from '@/components/JudgeMode';
import { PITCH, BRAND_NAME } from '@/brand';
import Link from 'next/link';
import { NETWORK } from '@/lib/chain/config';
import { NoPay } from '@/components/NoPay';

// Rendered on the server from the chain (5 s timeout, last-known fallback), refreshed every 10 s,
// then hydrated and kept live in the browser by polling the server's chain relay every 4 s.
export const revalidate = 10;

export default async function Home() {
  const r = DEMO ? await getSnapshot(DEMO.params) : { snap: null, stale: true };
  // If the chain is unreachable during a background revalidation, throw: Next.js then keeps
  // serving the last good page (with its "as of" time) instead of an empty one. The first
  // render at build time never throws, so the page always exists.
  if (DEMO && !r.snap && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('chain unreachable; keeping last good render');
  const net = NETWORK === 'mainnet' ? 'BCH mainnet' : NETWORK;
  const intro = (
    <div className="pt-1 sm:pt-10">
      <p className="eyebrow fade-up mb-5 hidden items-center gap-2 sm:flex">
        <span aria-hidden className="inline-block h-px w-6 bg-accent" /> Savings circles on Bitcoin Cash
      </p>
      <h1 className="display reveal" aria-label="Nobody holds the pot.">
        <span><span><em className="serif pr-[0.04em] font-normal italic tracking-[-0.02em]">Nobody</em> holds</span></span>
        <span><span>the pot.</span></span>
      </h1>
      <p className="fade-up mt-4 max-w-[34rem] text-[15.5px] leading-relaxed text-text-2 sm:mt-6 sm:text-[19px]" style={{ ['--d' as string]: '200ms' }}>
        {PITCH}
      </p>
      <p className="mt-4 hidden max-w-[34rem] text-[14px] leading-relaxed text-text-2 lg:block">
        Below is a real circle on {net}, read live from the chain through {BRAND_NAME}’s server relay. Its rounds are 10 minutes long so you can watch a whole cycle; real circles use a day or a week.
      </p>
    </div>
  );
  return (
    <>
      {DEMO ? (
        <JudgeMode intro={intro} initial={r.snap} stale={r.stale} paramsJson={DEMO.paramsJson} names={DEMO.seatNames} circleName={DEMO.name} events={DEMO.events} />
      ) : (
        <>
          {intro}
          <p className="mt-8 text-text-2">No demo circle is configured for this network yet.</p>
        </>
      )}
      <p className="mt-6 text-[13px] text-text-2 lg:hidden">
        A real circle on {net}, read live through {BRAND_NAME}’s server relay. Its rounds are 10 minutes long so you can watch a whole cycle; real circles use a day or a week.
      </p>

      <section className="mt-24 border-t rule pt-10" aria-labelledby="habit">
        <h2 id="habit" className="max-w-3xl text-[clamp(28px,4.4vw,52px)] font-semibold leading-[1.02] tracking-[-0.035em]">
          Rotating savings circles are a <span className="serif font-normal italic">global habit.</span>
        </h2>
        <ul className="mt-10 grid grid-cols-2 border-l border-t rule sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['tandas', 'Mexico'], ['hui', 'China'], ['chit funds', 'India'], ['susu', 'Ghana'], ['ajo', 'Nigeria'], ['esusu', 'Nigeria'],
          ].map(([name, where]) => (
            <li key={name} className="border-b border-r rule px-4 py-5">
              <div className="serif text-[clamp(26px,3vw,36px)] italic leading-none">{name}</div>
              <div className="eyebrow mt-3 !text-[10px]">{where}</div>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-text-2">
          Ajo and esusu in Nigeria is where {BRAND_NAME} started. Each member pays a fixed amount every round and a covenant pays the whole pot to the member whose turn it is. {BRAND_NAME} puts that circle on Bitcoin Cash.
        </p>
      </section>

      <NoPay />

      <section className="mt-24 grid items-end gap-8 rounded-[24px] border rule bg-surface p-7 sm:p-12 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-[clamp(32px,5vw,60px)] font-semibold leading-[0.98] tracking-[-0.04em]">
            Start your own <span className="serif font-normal italic">circle.</span>
          </h2>
          <p className="mt-4 max-w-xl text-text-2">3 to 5 members, a fixed amount, a fixed round length. Nothing can be changed after creation, and there is no admin key.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/new" className="btn btn-gold px-6 py-3.5 text-[15px]">Start a circle →</Link>
          <Link href="/deck" className="btn btn-ghost px-6 py-3.5 text-[15px]">Read the deck</Link>
        </div>
      </section>
    </>
  );
}
