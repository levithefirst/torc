'use client';
// WizardConnect wallet session for Torc. The wallet shares xpubs for its "receive" and
// "change" paths; we derive addresses, find the user's UTXOs, build the tx with placeholder
// P2PKH unlockers, and ask the wallet to sign exactly those inputs (inputPaths). Covenant
// inputs are unlocked by the contract itself. We broadcast the signed tx over Electrum.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import { placeholderP2PKHUnlocker, isPlaceholderUnlocker, type SpendableUtxo, type TransactionBuilder } from 'cashscript';
import { encodeCashAddress, hash160, binToHex, stringify } from '@bitauth/libauth';
import { BRAND_NAME, BRAND_SLUG } from '@/brand';
import { NETWORK, electrumHosts, BROWSER_WSS } from '@/lib/chain/config';
import { wsWithRelayFallback, relayCaller } from '@/lib/chain/electrum';
import { TorcProvider } from '@/lib/chain/provider';
import { prefixFor } from '@/lib/torc/address';
import type { WalletSide } from '@/lib/torc/txs';

export interface HdAddress { path: 'receive' | 'change'; index: number; address: string; tokenAddress: string; lockingHex: string }

interface WalletCtx {
  state: string;
  /**
   * True after a reload while the stored session is being restored: the wallet's xpubs come
   * from storage, so addresses and seats show at once, but signing needs the wallet to answer.
   */
  restored: boolean;
  /** connected, or restored from storage: seats can be shown and actions attempted. */
  ready: boolean;
  /** The last sign request got no answer from the wallet: offer a fresh pairing. */
  signTimedOut: boolean;
  walletName: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  addresses: HdAddress[];
  utxos: SpendableUtxo[];
  scanning: boolean;
  /** Rescan the wallet's addresses; resolves with the fresh coin list. */
  rescan: () => Promise<SpendableUtxo[]>;
  provider: TorcProvider;
  /** Wallet side for the tx builders (placeholder unlockers; the wallet signs later). */
  walletSide: () => WalletSide | null;
  /** Ask the wallet to sign the builder's wallet inputs, then broadcast. Returns the txid. */
  signAndSend: (builder: TransactionBuilder, prompt: string) => Promise<string>;
}

const Ctx = createContext<WalletCtx | null>(null);
export const useWallet = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWallet outside WalletProvider');
  return c;
};

const CHILD = { receive: 0, change: 1 } as const;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const icon = typeof window !== 'undefined' ? `${window.location.origin}/apple-icon` : undefined;
  // The stored session is per network: a chipnet pairing (xpubs, relay keys) is never restored on mainnet.
  const wc = useWizardConnect({ dappName: BRAND_NAME, dappIcon: icon, sessionKey: `${BRAND_SLUG}-wizardconnect-${NETWORK}` });
  useEffect(() => {
    // Sessions saved before the key carried the network were chipnet pairings: drop them.
    try { localStorage.removeItem(`${BRAND_SLUG}-wizardconnect`); } catch {}
  }, []);
  const [signTimedOut, setSignTimedOut] = useState(false);
  // Chain reads and broadcasts go through the site's HTTPS relay (no blocked-WebSocket noise);
  // NEXT_PUBLIC_BROWSER_WSS=1 restores the direct Electrum WebSocket with the relay as fallback.
  const provider = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return new TorcProvider(BROWSER_WSS ? wsWithRelayFallback(electrumHosts(), origin, 8000) : relayCaller(origin), NETWORK);
  }, []);
  const [addresses, setAddresses] = useState<HdAddress[]>([]);
  const [utxos, setUtxos] = useState<SpendableUtxo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const rescan = useCallback(async () => {
    const m = wc.manager;
    if (!m) return [];
    setScanning(true);
    try {
      const found: HdAddress[] = [];
      for (const path of ['receive', 'change'] as const) {
        const limit = path === 'receive' ? 20 : 10;
        for (let i = 0; i < limit; i++) {
          const pub = m.getPubkey(CHILD[path], BigInt(i));
          if (!pub) break;
          const pkh = hash160(pub);
          found.push({
            path, index: i,
            address: encodeCashAddress({ payload: pkh, prefix: prefixFor(NETWORK), type: 'p2pkh' }).address,
            tokenAddress: encodeCashAddress({ payload: pkh, prefix: prefixFor(NETWORK), type: 'p2pkhWithTokens' }).address,
            lockingHex: '76a914' + binToHex(pkh) + '88ac',
          });
        }
      }
      const lists = await Promise.all(found.map((a) => provider.getUtxosForLockingBytecode(a.lockingHex).catch(() => [])));
      setAddresses(found);
      const all = lists.flat();
      setUtxos(all);
      return all;
    } finally {
      setScanning(false);
    }
  }, [wc.manager, provider]);

  // Why a reload used to lose the wallet: on restore, @wizardconnect/react sits in 'connecting'
  // until the wallet answers dapp_ready with wallet_ready, and some wallets (the Paytaca
  // extension in our test) never answer a restored session. The manager has already restored
  // the wallet's xpubs from storage though, so we can derive addresses and show seats now, and
  // a sign request still reaches the wallet if it is listening (pending requests are re-sent
  // when its wallet_ready does arrive). If it is not, the request times out with a clear message.
  // 'reconnecting' (a relay drop, even mid-session after a fresh pairing) keeps the known xpubs, so
  // seats stay on screen; 'connecting' counts only for a restore (a fresh pairing has a uri).
  const hasPaths = !!wc.manager?.hasPath(CHILD.receive);
  const restored = hasPaths && (wc.state === 'reconnecting' || (wc.state === 'connecting' && !wc.uri));
  const ready = (wc.state === 'connected' && !!wc.manager) || restored;
  useEffect(() => {
    if (wc.state === 'connected') { setShowQr(false); setSignTimedOut(false); }
    if (wc.state === 'disconnected' || wc.state === 'idle') { setAddresses([]); setUtxos([]); }
  }, [wc.state]);
  // Scan once per session (not again when a restored session turns connected).
  const scannedFor = useRef<unknown>(null);
  useEffect(() => {
    if (!ready || !wc.manager) return;
    if (scannedFor.current === wc.manager) return;
    scannedFor.current = wc.manager;
    rescan();
  }, [ready, wc.manager, rescan]);

  const byLock = useMemo(() => new Map(addresses.map((a) => [a.lockingHex, a])), [addresses]);

  const walletSide = useCallback((): WalletSide | null => {
    const recv = addresses.find((a) => a.path === 'receive' && a.index === 0);
    if (!recv) return null;
    return {
      utxos,
      address: recv.address,
      unlocker: (u: SpendableUtxo) => placeholderP2PKHUnlocker(byLock.get(u.lockingBytecode)?.address ?? recv.address),
    };
  }, [addresses, utxos, byLock]);

  const signAndSend = useCallback(async (builder: TransactionBuilder, prompt: string) => {
    const m = wc.manager;
    if (!m) throw new Error('wallet not connected');
    const inputPaths: [number, string, number][] = [];
    builder.inputs.forEach((inp, i) => {
      if (!isPlaceholderUnlocker(inp.unlocker)) return;
      const a = byLock.get(inp.lockingBytecode);
      if (!a) throw new Error(`input ${i} is not from a known wallet address`);
      inputPaths.push([i, a.path, a.index]);
    });
    const transaction = builder.generateWcTransactionObject({ broadcast: false, userPrompt: prompt });
    // The relay sends plain JSON: encode BigInt/Uint8Array as WizardConnect extended JSON
    // (`<bigint: Xn>`, `<Uint8Array: 0x..>`), which wallets decode with parseExtendedJson.
    // The transaction itself goes as hex (Paytaca decodes `transaction` with hexToBin; hex is
    // valid per @bch-wc2/interfaces for every wallet).
    const relaySafe = { ...JSON.parse(stringify(transaction)), transaction: builder.build() };
    // A restored session may have no wallet on the other end: give up after 60 s.
    const ac = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ac.abort(new Error('Your wallet did not answer. Open it, or tap "Pair again" and scan once more.')); }, 60_000);
    const res = await m.signTransaction({ transaction: relaySafe as never, inputPaths }, { signal: ac.signal })
      .catch((e: unknown) => { if (timedOut) setSignTimedOut(true); throw new Error((e as Error)?.message || 'Signing was cancelled'); })
      .finally(() => clearTimeout(timer));
    if (res.error || !res.signedTransaction) throw new Error(res.error || 'wallet returned no signature');
    const txid = await provider.sendRawTransaction(res.signedTransaction);
    setTimeout(rescan, 1500);
    return txid;
  }, [wc.manager, byLock, provider, rescan]);

  // After a reload the hook auto-restores the stored session and sits in 'connecting' until the
  // wallet answers; if the wallet dropped that session it never will, and wc.connect() is a no-op
  // while connecting. So a click while connecting/reconnecting tears the session down and starts
  // a fresh pairing once the hook is back to idle.
  const [repair, setRepair] = useState(false);
  // A restored session that is still usable is never torn down by this button; only after a sign
  // request timed out (or when there is no usable session at all) does it start a fresh pairing.
  const connect = useCallback(() => {
    if (restored && !signTimedOut) return;
    setShowQr(true);
    if (wc.state === 'connecting' && wc.uri) return; // fresh pairing already waiting: just show the QR
    if (wc.state === 'connecting' || wc.state === 'reconnecting') { setRepair(true); setSignTimedOut(false); void wc.disconnect(); return; }
    wc.connect();
  }, [wc, restored, signTimedOut]);
  useEffect(() => {
    if (repair && wc.state === 'idle') { setRepair(false); wc.connect(); }
  }, [repair, wc]);

  const value: WalletCtx = {
    state: wc.state, restored, ready, signTimedOut, walletName: wc.walletName, error: wc.error, connect, disconnect: wc.disconnect,
    addresses, utxos, scanning, rescan, provider, walletSide, signAndSend,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {wc.uri && wc.qrUri && (
        <WizardConnectQRDialog
          show={showQr && wc.state === 'connecting'}
          onClose={() => { setShowQr(false); wc.disconnect(); }}
          uri={wc.uri}
          qrUri={wc.qrUri}
          title={`Connect to ${BRAND_NAME}`}
          subtitle="Scan with Selene or another WizardConnect wallet"
          theme={{ dialogBackground: '#191714', headerBackground: '#191714', titleColor: '#F6F3EF', subtitleColor: '#AEAAA3', qrForeground: '#100E0B', qrBackground: '#FBF9F5', uriRowBackground: '#22201C', uriTextColor: '#AEAAA3', borderColor: '#302D29', closeButtonColor: '#AEAAA3', copyButtonColor: '#AEAAA3' }}
        />
      )}
    </Ctx.Provider>
  );
}

export function ConnectButton() {
  const w = useWallet();
  if (w.restored)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="wallet-restored">
        <span className="text-text-2">{w.state === 'reconnecting' ? 'Reconnecting' : 'Session restored'}{w.walletName ? ` with ${w.walletName}` : ''}{w.scanning ? ' · scanning…' : ` · ${w.utxos.length} coins`}. Keep your wallet open to sign.</span>
        {w.signTimedOut && <button onClick={w.connect} className="rounded border border-border px-2 py-1 text-[12px]">Pair again</button>}
        <button onClick={() => w.disconnect()} className="rounded border border-border px-2 py-1 text-[12px]">Disconnect</button>
      </div>
    );
  if (w.state === 'connected')
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="wallet-connected">
        <span className="text-text-2">Connected{w.walletName ? ` to ${w.walletName}` : ''}{w.scanning ? ' · scanning…' : ` · ${w.utxos.length} coins`}</span>
        <button onClick={() => w.rescan()} className="rounded border border-border px-2 py-1 text-[12px]">Refresh</button>
        <button onClick={() => w.disconnect()} className="rounded border border-border px-2 py-1 text-[12px]">Disconnect</button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button data-testid="connect-wallet" onClick={w.connect} className="rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover [html:not(.dark)_&]:border [html:not(.dark)_&]:border-text">
        {w.state === 'connecting' || w.state === 'reconnecting' ? 'Waiting for wallet… (tap to pair again)' : 'Connect wallet (WizardConnect)'}
      </button>
      {w.error && <span className="text-sm text-danger">{w.error}</span>}
    </div>
  );
}
