import { CreateCircle } from '@/components/CreateCircle';
import { BRAND_NAME } from '@/brand';
import { NETWORK } from '@/lib/chain/config';

export const metadata = { title: 'Start a circle' };

export default function NewCircle() {
  return (
    <>
      <section className="py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Start a {BRAND_NAME} circle</h1>
        <p className="mt-2 max-w-2xl text-text-2">
          3 to 5 members, a fixed amount, a fixed round length. The covenant holds the pot and pays it only to the seat whose turn it is.
          Nothing here can be changed after creation, and there is no admin key. Network: <b className="text-text">{NETWORK}</b>.
        </p>
      </section>
      <CreateCircle />
    </>
  );
}
