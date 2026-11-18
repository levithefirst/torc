import { DEMO } from '@/lib/app/demo';
import { getSnapshot } from '@/lib/server/chain';
import { JudgeMode } from '@/components/JudgeMode';
import { PITCH, BRAND_NAME } from '@/brand';
import Link from 'next/link';

// Rendered on the server from the chain (5 s timeout, last-known fallback), refreshed every 10 s,
// then hydrated and kept live in the browser over Electrum WebSocket.
export const revalidate = 10;

export default async function Home() {
  const r = DEMO ? await getSnapshot(DEMO.params) : { snap: null, stale: true };
  return (
    <>
      <section className="py-6">
        <h1 className="max-w-2xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">{PITCH}</h1>
        <p className="mt-3 max-w-2xl text-text-2">
          {BRAND_NAME} is an ajo / esusu savings circle on Bitcoin Cash. Each member pays a fixed amount every round and a covenant pays the
          whole pot to the member whose turn it is. Below is a real circle, read straight from the chain.{' '}
          <Link href="/new" className="text-accent-text underline underline-offset-2">Start your own</Link>.
        </p>
      </section>
      {DEMO ? (
        <JudgeMode initial={r.snap} stale={r.stale} paramsJson={DEMO.paramsJson} names={DEMO.seatNames} circleName={DEMO.name} events={DEMO.events} />
      ) : (
        <p className="text-text-2">No demo circle is configured for this network yet.</p>
      )}
    </>
  );
}
