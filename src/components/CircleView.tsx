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
    <section className="grid gap-8 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div>
        <h1 className="mb-1 text-lg font-semibold">{name}</h1>
        <p className="num mb-3 break-all text-[12px] text-text-2" data-testid="covenant-address">{snap.tokenAddress}</p>
        <Ring snap={snap} names={names} />
      </div>
      <div className="grid min-w-0 content-start gap-5">
        <p className="text-[15px]">
          <span className="num text-xl font-semibold">{fmtUnits(snap.potUnits, asset)}</span> <span className="text-text-2">in the ring ·</span> {snap.paid} of {params.seats} paid · {payoutLine(snap, Date.now())}
        </p>
        <MemberPanel snap={snap} params={params} names={names} onSent={() => setTimeout(refresh, 800)} />
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-2">On-chain activity</h3>
          <Feed rows={snap.feed} names={names} asset={asset} total={snap.historyCount} address={snap.address} />
        </div>
      </div>
    </section>
  );
}
