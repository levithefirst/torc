'use client';
import type { Snapshot } from '@/lib/torc/snapshot';
import { hasPaid } from '@/lib/torc/state';
import { seatName } from '@/lib/app/demo';

const C = 120, R = 100, r = 70, GAP = 7;
const pt = (rad: number, deg: number) => [C + rad * Math.cos((deg * Math.PI) / 180), C + rad * Math.sin((deg * Math.PI) / 180)] as const;

/** One seat, drawn like a segment of the Torc mark: the inner edge is turned clockwise, so the ring reads as motion. */
function sector(a0: number, a1: number, skew: number) {
  const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1 + skew), [x3, y3] = pt(r, a0 + skew);
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
  const skew = Math.min(22, span * 0.18);
  const colorOf = (i: number, st: SeatStatus) => (i === turn ? 'var(--turn)' : st === 'due' ? 'var(--due)' : st === 'mempool' ? 'var(--mempool)' : 'var(--confirmed)');
  return (
    <figure className="relative mx-auto w-full max-w-[460px]" data-testid="ring" data-seats={n} data-turn={turn}>
      <svg viewBox="0 0 240 240" className="w-full overflow-visible" role="img" aria-label={`Circle of ${n} seats, round ${snap.state.round}, ${seatName(names, turn)}'s turn`}>
        {/* Instrument bezel: a hairline track and one tick per seat boundary. */}
        <circle cx={C} cy={C} r={R + 9} fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx={C} cy={C} r={r - 9} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="1 4" />
        {Array.from({ length: n }, (_, i) => {
          const [ax, ay] = pt(R + 5, -90 + i * span), [bx, by] = pt(R + 13, -90 + i * span);
          return <line key={`t${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--border)" strokeWidth="1" />;
        })}
        {Array.from({ length: n }, (_, i) => {
          const a0 = -90 + i * span + GAP / 2, a1 = -90 + (i + 1) * span - GAP / 2;
          const st = statuses[i]!;
          const isTurn = i === turn;
          const color = colorOf(i, st);
          const fill = st === 'due' ? 'transparent' : color;
          return (
            <path
              key={i}
              d={sector(a0, a1, skew)}
              data-testid={`seat-${i}`}
              data-status={st}
              data-turn={isTurn ? 'true' : undefined}
              className={`seg ${isTurn ? 'turn-breathe' : ''}`}
              style={{ animationDelay: `${i * 90}ms` }}
              fill={fill}
              fillOpacity={st === 'mempool' ? 0.28 : 1}
              stroke={color}
              strokeWidth={st === 'confirmed' ? 0 : isTurn ? 2.5 : 1.6}
              strokeDasharray={st === 'mempool' ? '6 4' : undefined}
              strokeLinejoin="round"
            />
          );
        })}
        {/* Turn marker: a gold pointer outside the ring that steps clockwise on each payout. */}
        <g style={{ transform: `rotate(${markerAngle}deg)`, transformOrigin: '120px 120px', transition: 'transform 900ms cubic-bezier(.4,1.4,.6,1)' }}>
          <path d="M120 -1 L113.5 -11 L126.5 -11 Z" fill="var(--turn)" />
        </g>
        <text x="120" y="100" textAnchor="middle" className="num" fontSize="8.5" letterSpacing="1.6" fill="var(--text-2)">ROUND {snap.state.round + 1}</text>
        <text x="120" y="117" textAnchor="middle" fontSize="11" fill="var(--text-2)">pays</text>
        <text x="120" y="144" textAnchor="middle" fontSize="27" fontStyle="italic" fill="var(--text)" style={{ fontFamily: 'var(--font-serif)' }}>
          {seatName(names, turn)}
        </text>
        <text x="120" y="161" textAnchor="middle" className="num" fontSize="8.5" fill="var(--text-2)">{statuses.filter((x) => x !== 'due').length} / {n} paid</text>
      </svg>
      <figcaption className="sr-only">Turn: {seatName(names, turn)}</figcaption>
      <ul className="mt-5 grid gap-2 text-[13px]" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0,1fr))` }}>
        {statuses.map((st, i) => (
          <li key={i} className={`flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1.5 ${i === turn ? 'border-turn' : 'rule'}`} data-testid={`seat-label-${i}`}>
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ background: st === 'due' ? 'transparent' : colorOf(i, st), border: `1.5px ${st === 'mempool' ? 'dashed' : 'solid'} ${colorOf(i, st)}` }}
            />
            <span className="truncate font-medium">{seatName(names, i)}</span>
            <span className="num ml-auto shrink-0 text-[11px] text-text-2">{i === turn ? 'turn' : st === 'due' ? 'due' : st === 'mempool' ? '0-conf' : 'paid'}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
