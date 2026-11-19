import { CreateCircle } from '@/components/CreateCircle';
import { BRAND_NAME } from '@/brand';
import { NETWORK } from '@/lib/chain/config';

export const metadata = { title: 'Start a circle' };

export default function NewCircle() {
  return (
    <>
      <section className="pb-12 pt-6 sm:pb-16 sm:pt-12">
        <p className="eyebrow fade-up mb-5 flex items-center gap-2"><span aria-hidden className="inline-block h-px w-6 bg-accent" /> New circle · {NETWORK}</p>
        <h1 className="reveal text-[clamp(40px,7vw,88px)] font-semibold leading-[0.95] tracking-[-0.045em]" aria-label={`Start a ${BRAND_NAME} circle`}>
          <span><span>Start a {BRAND_NAME}</span></span>
          <span><span className="serif font-normal italic tracking-[-0.02em]">circle.</span></span>
        </h1>
        <p className="fade-up mt-6 max-w-2xl text-[17px] leading-relaxed text-text-2" style={{ ['--d' as string]: '200ms' }}>
          3 to 5 members, a fixed amount, a fixed round length. The covenant holds the pot and pays it only to the seat whose turn it is.
          Nothing here can be changed after creation, and there is no admin key. Network: <b className="font-medium text-text">{NETWORK}</b>.
        </p>
      </section>
      <CreateCircle />
    </>
  );
}
