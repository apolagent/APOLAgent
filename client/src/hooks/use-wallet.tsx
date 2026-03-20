import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider } from "ethers";
import { CHAIN } from "@/lib/chain-config";

const BASE_CHAIN_ID = CHAIN.id;
const BASE_HEX = CHAIN.hex;

const BASE_NETWORK = {
  chainId: BASE_HEX,
  chainName: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: [CHAIN.rpcUrl],
  blockExplorerUrls: [CHAIN.explorerUrl],
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`Timeout (${ms / 1000}s): ${label}`)), ms)
    ),
  ]);
}

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}

// Module-level selected provider — accessible from transaction pages
let _selectedProvider: any = null;

export function getSelectedProvider(): any {
  if (_selectedProvider) return _selectedProvider;
  return typeof window !== "undefined" ? (window as any).ethereum ?? null : null;
}

export function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

export type WalletState = {
  address: string | null;
  truncated: string | null;
  chainId: number | null;
  isBase: boolean;
  isConnecting: boolean;
  isSwitching: boolean;
  isIframe: boolean;
  providers: EIP6963ProviderDetail[];
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  connect: () => Promise<void>;
  connectWith: (detail: EIP6963ProviderDetail) => Promise<void>;
  switchToBase: () => Promise<void>;
};

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [inIframe] = useState(() => isInIframe());
  const listenersRef = useRef<{ onAccounts: (a: string[]) => void; onChain: (h: string) => void } | null>(null);

  // EIP-6963: discover all injected wallets
  useEffect(() => {
    const seen = new Set<string>();

    const onAnnounce = (event: any) => {
      const detail: EIP6963ProviderDetail = event.detail;
      if (!detail?.info?.uuid || seen.has(detail.info.uuid)) return;
      seen.add(detail.info.uuid);
      console.log(`[APOL Wallet] EIP-6963 provider detected: ${detail.info.name} (${detail.info.rdns})`);
      setProviders(prev => [...prev, detail]);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    // Ask all wallets to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Legacy fallback — also check window.ethereum after a short delay
    const timer = setTimeout(() => {
      const eth = (window as any).ethereum;
      if (eth && seen.size === 0) {
        console.log("[APOL Wallet] No EIP-6963 providers — using legacy window.ethereum");
        const legacy: EIP6963ProviderDetail = {
          info: { uuid: "legacy", name: eth?.isMetaMask ? "MetaMask" : "Browser Wallet", icon: "", rdns: "legacy" },
          provider: eth,
        };
        setProviders([legacy]);
      }
    }, 500);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      clearTimeout(timer);
    };
  }, []);

  // Attach account/chain listeners to the selected provider
  const attachListeners = useCallback((eth: any) => {
    if (listenersRef.current) {
      try {
        eth.removeListener?.("accountsChanged", listenersRef.current.onAccounts);
        eth.removeListener?.("chainChanged", listenersRef.current.onChain);
      } catch {}
    }
    const onAccounts = (accs: string[]) => {
      console.log("[APOL Wallet] accountsChanged →", accs[0] ?? "disconnected");
      setAddress(accs[0] ?? null);
    };
    const onChain = (hex: string) => {
      console.log("[APOL Wallet] chainChanged →", parseInt(hex, 16));
      setChainId(parseInt(hex, 16));
    };
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    listenersRef.current = { onAccounts, onChain };
  }, []);

  const readState = useCallback(async (eth: any) => {
    try {
      const accounts: string[] = await eth.request({ method: "eth_accounts" });
      setAddress(accounts[0] ?? null);
    } catch {}
    try {
      const hex: string = await eth.request({ method: "eth_chainId" });
      setChainId(parseInt(hex, 16));
    } catch {}
  }, []);

  const connectWith = useCallback(async (detail: EIP6963ProviderDetail) => {
    const eth = detail.provider;
    console.log(`[APOL Wallet] Connecting with: ${detail.info.name}...`);
    setIsConnecting(true);
    setShowPicker(false);
    try {
      const accounts: string[] = await withTimeout(
        eth.request({ method: "eth_requestAccounts" }),
        60_000,
        "eth_requestAccounts"
      );
      const addr = accounts[0] ?? null;
      _selectedProvider = eth;
      setAddress(addr);
      console.log(`[APOL Wallet] Connected via ${detail.info.name}:`, addr);
      const hex: string = await eth.request({ method: "eth_chainId" });
      setChainId(parseInt(hex, 16));
      attachListeners(eth);
    } catch (e: any) {
      if (e.code === 4001 || e.message?.includes("rejected")) {
        console.log("[APOL Wallet] User rejected connection.");
      } else {
        console.log("[APOL Wallet] Connection error:", e.message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [attachListeners]);

  const connect = useCallback(async () => {
    console.log(`[APOL Wallet] connect() called — ${providers.length} provider(s) available`);
    if (providers.length === 0) {
      console.log("[APOL Wallet] No providers found — opening MetaMask install page.");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    if (providers.length === 1) {
      await connectWith(providers[0]);
      return;
    }
    // Multiple providers: show picker
    console.log("[APOL Wallet] Multiple providers — showing picker.");
    setShowPicker(true);
  }, [providers, connectWith]);

  const switchToBase = useCallback(async () => {
    const eth = getSelectedProvider();
    if (!eth) return;
    console.log("[APOL Wallet] Switching to", CHAIN.name, BASE_HEX);
    setIsSwitching(true);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_HEX }] });
      console.log("[APOL Wallet] Network switched.");
    } catch (err: any) {
      console.log("[APOL Wallet] switchEthereumChain error:", err?.message);
      if (err.code === 4902) {
        try {
          await eth.request({ method: "wallet_addEthereumChain", params: [BASE_NETWORK] });
          console.log("[APOL Wallet] Network added.");
        } catch (addErr: any) {
          console.log("[APOL Wallet] addEthereumChain error:", addErr?.message);
        }
      }
    } finally {
      setIsSwitching(false);
      try {
        const hex: string = await eth.request({ method: "eth_chainId" });
        setChainId(parseInt(hex, 16));
      } catch {}
    }
  }, []);

  // Read initial state if already connected (e.g. page refresh)
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (eth) readState(eth);
  }, [readState]);

  const isBase = chainId === BASE_CHAIN_ID;
  const truncated = address ? truncate(address) : null;

  return {
    address, truncated, chainId, isBase,
    isConnecting, isSwitching,
    isIframe: inIframe,
    providers, showPicker, setShowPicker,
    connect, connectWith, switchToBase,
  };
}
