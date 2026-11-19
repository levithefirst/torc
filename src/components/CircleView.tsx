'use client';
import { useEffect, useMemo, useState } from 'react';
import { paramsFromJson, type CircleParamsJson } from '@/lib/torc/circle';
import type { Snapshot } from '@/lib/torc/snapshot';
import { useLiveSnapshot } from '@/hooks/useLiveSnapshot';
import { Ring } from './Ring';
import { Feed } from './Feed';
import { MemberPanel } from './MemberPanel';
import { assetInfo, fmtUnits } from '@/lib/app/demo';
import { payoutLine } from './JudgeMode';

export function CircleView({ address, demo }: { address: string; demo?: { paramsJson: CircleParamsJson; names: string[]; name: string } }) {
  const [loaded, setLoaded] = useState<{ paramsJson: CircleParamsJson; initial: Snapshot | null } | null>(demo ? { paramsJson: demo.paramsJson, initial: null } : null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (demo) return;
    fetch(`/api/circle?address=${encodeURIComponent(address)}`)
      .then(async (r) => {
        const j = await r.json();
        if (j.params) setLoaded({ paramsJson: j.params, initial: r.ok ? j : null });
        else setErr(j.error ?? 'Could not load this circle');
      })
      .catch((e) => setErr(String(e)));
  }, [address, demo]);
  if (err) return <p className="py-10 text-danger">{err}</p>;
  if (!loaded) return <p className="py-10 text-text-2">Reading this circle from the chain…</p>;
  return (
    <Inner paramsJson={loaded.paramsJson} initial={loaded.initial} names={demo?.names ?? []} name={demo?.name ?? 'Your circle'} />
  );
}

function Inner({ paramsJson, initial, names, name }: { paramsJson: CircleParamsJson; initial: Snapshot | null; names: string[]; name: string }) {
  const params = useMemo(() => paramsFromJson(paramsJson), [paramsJson]);
  const { snap, refresh } = useLiveSnapshot(params, initial);
  const asset = assetInfo(paramsJson);
  if (!snap) return <p className="py-10 text-text-2">Reading this circle from the chain…</p>;
  return (
    <section className="pt-4 sm:pt-8">
      <div className="mb-10 border-b rule pb-8">
        <p className="eyebrow mb-4 flex items-center gap-2"><span aria-hidden className="inline-block h-px w-6 bg-accent" /> Circle · {params.seats} seats · {fmtUnits(params.contribution, asset)} each</p>
        <h1 className="text-[clamp(36px,6vw,72px)] font-semibold leading-[0.95] tracking-[-0.045em]">{name}</h1>
        <p className="num mt-4 max-w-full break-all text-[12px] text-text-2" data-testid="covenant-address">{snap.tokenAddress}</p>
      </div>
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Ring snap={snap} names={names} />
        </div>
        <div className="grid min-w-0 content-start gap-8 lg:col-span-7">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-[20px] border rule bg-surface p-5 sm:p-7">
            <div>
              <div className="eyebrow mb-2">In the ring</div>
              <div className="num text-[clamp(36px,6vw,56px)] font-medium leading-none tracking-[-0.04em]">{fmtUnits(snap.potUnits, asset)}</div>
            </div>
            <p className="text-[14px] text-text-2"><span className="num text-text">{snap.paid} of {params.seats}</span> paid · {payoutLine(snap, Date.now())}</p>
          </div>
          <MemberPanel snap={snap} params={params} names={names} onSent={() => setTimeout(refresh, 800)} />
          <div>
            <h3 className="eyebrow mb-3">On-chain activity</h3>
            <Feed rows={snap.feed} names={names} asset={asset} total={snap.historyCount} address={snap.address} />
          </div>
        </div>
      </div>
    </section>
  );
}
