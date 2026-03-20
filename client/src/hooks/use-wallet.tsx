import { useState, useEffect, useCallback } from "react";
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

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms / 1000}s): ${label}`)), ms)
    ),
  ]);
}

// Always read window.ethereum fresh — never rely on a stale closure value
function getEth(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
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
  hasMetaMask: boolean;
  isIframe: boolean;
  connect: () => Promise<void>;
  switchToBase: () => Promise<void>;
};

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [inIframe] = useState(() => isInIframe());

  // Detect MetaMask reactively — it may load slightly after first render
  useEffect(() => {
    const check = () => {
      const detected = Boolean(getEth());
      setHasMetaMask(detected);
      if (detected) console.log("[APOL Wallet] window.ethereum detected.");
    };
    check();
    // MetaMask fires this event when it injects
    window.addEventListener("ethereum#initialized", check);
    const timer = setTimeout(check, 500);
    return () => {
      window.removeEventListener("ethereum#initialized", check);
      clearTimeout(timer);
    };
  }, []);

  // Read chain & account on mount, and listen for changes
  useEffect(() => {
    const eth = getEth();
    if (!eth) return;

    const readChain = async () => {
      try {
        const hex: string = await eth.request({ method: "eth_chainId" });
        setChainId(parseInt(hex, 16));
      } catch {}
    };
    const readAccount = async () => {
      try {
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        setAddress(accounts[0] ?? null);
      } catch {}
    };

    readAccount();
    readChain();

    const onAccounts = (accs: string[]) => {
      console.log("[APOL Wallet] accountsChanged →", accs[0] ?? "disconnected");
      setAddress(accs[0] ?? null);
    };
    const onChain = (hex: string) => {
      const id = parseInt(hex, 16);
      console.log("[APOL Wallet] chainChanged →", id);
      setChainId(id);
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, [hasMetaMask]); // re-run when MetaMask becomes available

  const switchToBase = useCallback(async () => {
    const eth = getEth();
    if (!eth) return;
    console.log("[APOL Wallet] Switching to", CHAIN.name, `(${BASE_HEX})...`);
    setIsSwitching(true);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_HEX }] });
      console.log("[APOL Wallet] Network switched.");
    } catch (err: any) {
      console.log("[APOL Wallet] switchEthereumChain error:", err?.message);
      if (err.code === 4902) {
        console.log("[APOL Wallet] Chain not in MetaMask — adding...");
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

  const connect = useCallback(async () => {
    const eth = getEth();
    if (!eth) {
      console.log("[APOL Wallet] MetaMask not found — opening install page.");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    console.log("[APOL Wallet] Attempting connection...");
    setIsConnecting(true);
    try {
      const accounts: string[] = await withTimeout(
        eth.request({ method: "eth_requestAccounts" }),
        60_000,
        "eth_requestAccounts"
      );
      const addr = accounts[0] ?? null;
      setAddress(addr);
      console.log("[APOL Wallet] Connected:", addr);
      const hex: string = await eth.request({ method: "eth_chainId" });
      setChainId(parseInt(hex, 16));
    } catch (e: any) {
      if (e.code === 4001 || e.message?.includes("rejected")) {
        console.log("[APOL Wallet] User rejected connection.");
      } else {
        console.log("[APOL Wallet] Connection error:", e.message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const isBase = chainId === BASE_CHAIN_ID;
  const truncated = address ? truncate(address) : null;

  return {
    address, truncated, chainId, isBase,
    isConnecting, isSwitching, hasMetaMask,
    isIframe: inIframe,
    connect, switchToBase,
  };
}
