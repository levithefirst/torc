'use client';
import type { Snapshot } from '@/lib/torc/snapshot';
import { hasPaid } from '@/lib/torc/state';
import { seatName } from '@/lib/app/demo';

const C = 120, R = 98, r = 68, GAP = 6;
const pt = (rad: number, deg: number) => [C + rad * Math.cos((deg * Math.PI) / 180), C + rad * Math.sin((deg * Math.PI) / 180)] as const;

function sector(a0: number, a1: number) {
  const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
}

export type SeatStatus = 'confirmed' | 'mempool' | 'due';

export function seatStatuses(s: Snapshot): SeatStatus[] {
  const seats = s.params.seats;
  return Array.from({ length: seats }, (_, i) => {
    if (!hasPaid(s.state, i)) return 'due';
    const row = s.feed.find((f) => f.kind === 'contribute' && f.seat === i && f.round === s.state.round);
    return row && row.height <= 0 ? 'mempool' : 'confirmed';
  });
}

/** The circle: one segment per seat, clockwise from the top. Gold = whose turn it is. */
export function Ring({ snap, names }: { snap: Snapshot; names: string[] }) {
  const n = snap.params.seats;
  const span = 360 / n;
  const statuses = seatStatuses(snap);
  const turn = snap.turnSeat;
  const markerAngle = turn * span + span / 2; // degrees clockwise from top
  return (
    <figure className="relative mx-auto w-full max-w-[340px]" data-testid="ring" data-seats={n} data-turn={turn}>
      <svg viewBox="0 0 240 240" className="w-full" role="img" aria-label={`Circle of ${n} seats, round ${snap.state.round}, ${seatName(names, turn)}'s turn`}>
        {Array.from({ length: n }, (_, i) => {
          const a0 = -90 + i * span + GAP / 2, a1 = -90 + (i + 1) * span - GAP / 2;
          const st = statuses[i]!;
          const isTurn = i === turn;
          const color = isTurn ? 'var(--turn)' : st === 'due' ? 'var(--due)' : st === 'mempool' ? 'var(--mempool)' : 'var(--confirmed)';
          const fill = st === 'confirmed' ? color : st === 'mempool' ? color : 'transparent';
          return (
            <path
              key={i}
              d={sector(a0, a1)}
              data-testid={`seat-${i}`}
              data-status={st}
              data-turn={isTurn ? 'true' : undefined}
              fill={fill}
              fillOpacity={st === 'mempool' ? 0.28 : 1}
              stroke={color}
              strokeWidth={st === 'confirmed' ? 0 : 2.5}
              strokeDasharray={st === 'mempool' ? '7 5' : undefined}
              strokeLinejoin="round"
            />
          );
        })}
        {/* Turn marker: a small gold pointer outside the ring that steps clockwise on each payout. */}
        <g style={{ transform: `rotate(${markerAngle}deg)`, transformOrigin: '120px 120px', transition: 'transform 700ms cubic-bezier(.4,1.4,.6,1)' }}>
          <path d="M120 2 L113 13 L127 13 Z" fill="var(--turn)" />
        </g>
        <text x="120" y="112" textAnchor="middle" className="num" fontSize="13" fill="var(--text-2)">Round {snap.state.round + 1}</text>
        <text x="120" y="134" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--text)">
          pays {seatName(names, turn)}
        </text>
      </svg>
      <figcaption className="sr-only">Turn: {seatName(names, turn)}</figcaption>
      <ul className="mt-2 grid gap-1 text-[13px]" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0,1fr))` }}>
        {statuses.map((st, i) => (
          <li key={i} className="flex items-center gap-1.5" data-testid={`seat-label-${i}`}>
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{
                background: st === 'confirmed' ? (i === turn ? 'var(--turn)' : 'var(--confirmed)') : 'transparent',
                border: `2px ${st === 'mempool' ? 'dashed' : 'solid'} ${i === turn ? 'var(--turn)' : st === 'due' ? 'var(--due)' : st === 'mempool' ? 'var(--mempool)' : 'var(--confirmed)'}`,
              }}
            />
            <span className="truncate font-medium">{seatName(names, i)}</span>
            <span className="text-text-2">{i === turn ? 'turn' : st === 'due' ? 'due' : st === 'mempool' ? '0-conf' : 'paid'}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
