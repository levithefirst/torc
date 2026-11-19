import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Instrument_Serif } from 'next/font/google';
import './globals.css';
import { BRAND_NAME, TAGLINE } from '@/brand';
import { Banner } from '@/components/Banner';
import { Header } from '@/components/Header';
import { WalletProvider } from '@/lib/wallet/WalletProvider';
import { Footer } from '@/components/Footer';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${BRAND_NAME}: rotating savings on Bitcoin Cash`, template: `%s · ${BRAND_NAME}` },
  description: TAGLINE,
  applicationName: BRAND_NAME,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://torc.vercel.app'),
  openGraph: { title: BRAND_NAME, description: TAGLINE, siteName: BRAND_NAME, type: 'website' },
  twitter: { card: 'summary_large_image', title: BRAND_NAME, description: TAGLINE },
};

export const viewport: Viewport = { themeColor: '#100E0B', width: 'device-width', initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('torc-theme');if(t==='light')document.documentElement.classList.remove('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh overflow-x-hidden">
        <Banner />
        <Header />
        {/* One wallet session for the whole app, so it survives client navigation (e.g. /new -> /circle). */}
        <WalletProvider>
          <main className="mx-auto max-w-6xl px-5 pb-10 sm:px-6">{children}</main>
        </WalletProvider>
        <Footer />
      </body>
    </html>
  );
}
