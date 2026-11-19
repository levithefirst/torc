'use client';
// WizardConnect wallet session for Torc. The wallet shares xpubs for its "receive" and
// "change" paths; we derive addresses, find the user's UTXOs, build the tx with placeholder
// P2PKH unlockers, and ask the wallet to sign exactly those inputs (inputPaths). Covenant
// inputs are unlocked by the contract itself. We broadcast the signed tx over Electrum.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import { placeholderP2PKHUnlocker, isPlaceholderUnlocker, type SpendableUtxo, type TransactionBuilder } from 'cashscript';
import { encodeCashAddress, hash160, binToHex } from '@bitauth/libauth';
import { BRAND_NAME, BRAND_SLUG } from '@/brand';
import { NETWORK, electrumHosts } from '@/lib/chain/config';
import { wsWithRelayFallback } from '@/lib/chain/electrum';
import { TorcProvider } from '@/lib/chain/provider';
import { prefixFor } from '@/lib/torc/address';
import type { WalletSide } from '@/lib/torc/txs';

export interface HdAddress { path: 'receive' | 'change'; index: number; address: string; tokenAddress: string; lockingHex: string }

interface WalletCtx {
  state: string;
  walletName: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  addresses: HdAddress[];
  utxos: SpendableUtxo[];
  scanning: boolean;
  rescan: () => Promise<void>;
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
  const wc = useWizardConnect({ dappName: BRAND_NAME, dappIcon: icon, sessionKey: `${BRAND_SLUG}-wizardconnect` });
  const provider = useMemo(() => new TorcProvider(wsWithRelayFallback(electrumHosts(), typeof window !== 'undefined' ? window.location.origin : '', 8000), NETWORK), []);
  const [addresses, setAddresses] = useState<HdAddress[]>([]);
  const [utxos, setUtxos] = useState<SpendableUtxo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const rescan = useCallback(async () => {
    const m = wc.manager;
    if (!m) return;
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
      setUtxos(lists.flat());
    } finally {
      setScanning(false);
    }
  }, [wc.manager, provider]);

  useEffect(() => {
    if (wc.state === 'connected' && wc.manager) {
      setShowQr(false);
      rescan();
    }
    if (wc.state === 'disconnected' || wc.state === 'idle') { setAddresses([]); setUtxos([]); }
  }, [wc.state, wc.manager, rescan]);

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
    const res = await m.signTransaction({ transaction: transaction as never, inputPaths });
    if (res.error || !res.signedTransaction) throw new Error(res.error || 'wallet returned no signature');
    const txid = await provider.sendRawTransaction(res.signedTransaction);
    setTimeout(rescan, 1500);
    return txid;
  }, [wc.manager, byLock, provider, rescan]);

  const connect = useCallback(() => { wc.connect(); setShowQr(true); }, [wc]);

  const value: WalletCtx = {
    state: wc.state, walletName: wc.walletName, error: wc.error, connect, disconnect: wc.disconnect,
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
        {w.state === 'connecting' ? 'Waiting for wallet…' : 'Connect wallet (WizardConnect)'}
      </button>
      {w.error && <span className="text-sm text-danger">{w.error}</span>}
    </div>
  );
}
