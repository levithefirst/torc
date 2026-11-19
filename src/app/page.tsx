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
  return (
    <>
      <section className="pb-5 pt-2 sm:py-6">
        <h1 className="max-w-2xl text-lg font-semibold leading-snug tracking-tight sm:text-3xl">{PITCH}</h1>
        <p className="mt-2 hidden max-w-2xl text-text-2 sm:block">
          Rotating savings circles are a global habit: tandas in Mexico, hui in China, chit funds in India, susu in Ghana, ajo and esusu in Nigeria, where {BRAND_NAME} started. {BRAND_NAME} puts one on Bitcoin Cash. Each member pays a fixed amount every round and a covenant pays the
          whole pot to the member whose turn it is. Below is a real circle on {NETWORK}, read live from the chain through {BRAND_NAME}’s server relay. Its rounds are 10 minutes long so you can watch a whole cycle; real circles use a day or a week.{' '}
          <Link href="/new" className="text-accent-text underline underline-offset-2">Start your own</Link>.
        </p>
      </section>
      {DEMO ? (
        <JudgeMode initial={r.snap} stale={r.stale} paramsJson={DEMO.paramsJson} names={DEMO.seatNames} circleName={DEMO.name} events={DEMO.events} />
      ) : (
        <p className="text-text-2">No demo circle is configured for this network yet.</p>
      )}
      <NoPay />
    </>
  );
}
