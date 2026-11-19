import { REPO_URL } from '@/lib/chain/config';
import { DEMO } from '@/lib/app/demo';

// Link the contract the live demo circle actually runs (BCH mode: TorcCircleBch.cash, lines 87-89).
const CLAIM_CHECK = DEMO?.paramsJson.mode === 'bch' ? 'TorcCircleBch.cash#L87-L89' : 'TorcCircle.cash#L88-L90';

/** The first question every savings-circle member asks, answered honestly: what Torc does today, and v2. */
export function NoPay({ compact = false }: { compact?: boolean }) {
  return (
    <section id="if-someone-doesnt-pay" className={compact ? '' : 'mt-24 border-t rule pt-10'} data-testid="no-pay">
      <div className="grid gap-x-14 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="text-[clamp(28px,4vw,44px)] font-semibold leading-[1.02] tracking-[-0.035em]">If someone <span className="serif font-normal italic">doesn’t pay</span></h2>
          <p className="mt-4 max-w-sm text-[14px] text-text-2">The first question every circle member asks. Here is the honest answer for today, and the v2 design.</p>
        </div>
      <div className="grid gap-px overflow-hidden rounded-[20px] border rule bg-line text-sm md:grid-cols-2 lg:col-span-8">
        <div className="bg-bg p-5 sm:p-7">
          <h3 className="eyebrow mb-4 flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-full bg-text" /> What happens today</h3>
          <ul className="grid gap-3 text-text-2 [&>li]:border-t [&>li]:border-line [&>li]:pt-3 [&>li:first-child]:border-0 [&>li:first-child]:pt-0">
            <li>The payout needs every seat paid (<a className="link" href={`${REPO_URL}/blob/main/contracts/${CLAIM_CHECK}`}>claim() checks it</a>), so one missing payment pauses the round. Nobody, including the organiser, can take the pot early or run off with it.</li>
            <li>The money already paid in stays locked in the covenant until the missing seat pays. There is no deadline, so a late payment still unlocks the round.</li>
            <li>A seat is an NFT, so a member who wants out can hand or sell their seat to someone who will keep paying.</li>
            <li className="text-text"><b className="text-warning">Not solved yet.</b> There is no refund or timeout yet. If a seat never pays, the paid-in money for that round stays stuck. A member who has already taken the pot and then stops paying is not stopped by v1 either. We say this up front because it is the main risk.</li>
          </ul>
        </div>
        <div className="bg-bg p-5 sm:p-7">
          <h3 className="eyebrow mb-4 flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-full border border-text" /> The v2 design</h3>
          <ul className="grid gap-3 text-text-2 [&>li]:border-t [&>li]:border-line [&>li]:pt-3 [&>li:first-child]:border-0 [&>li:first-child]:pt-0">
            <li><b className="text-text">Timeout refund.</b> If a round is not full by its deadline plus a grace period, each member who paid can take their own contribution back with their seat NFT, and the round reopens.</li>
            <li><b className="text-text">Bond.</b> Each seat locks a bond when it joins. A seat that misses a round loses its bond to the members who paid.</li>
            <li><b className="text-text">Bigger bond after your payout.</b> When you take the pot, the covenant keeps back the contributions you still owe as a bond, and releases it round by round as you pay. Taking the pot and leaving no longer pays.</li>
            <li>None of this needs an admin key. It is all covenant rules, like v1.</li>
          </ul>
        </div>
      </div>
      </div>
    </section>
  );
}
