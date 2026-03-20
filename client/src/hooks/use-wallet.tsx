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

export type WalletState = {
  address: string | null;
  truncated: string | null;
  chainId: number | null;
  isBase: boolean;
  isConnecting: boolean;
  isSwitching: boolean;
  hasMetaMask: boolean;
  connect: () => Promise<void>;
  switchToBase: () => Promise<void>;
};

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
  const hasMetaMask = Boolean(eth);

  const readChain = useCallback(async () => {
    if (!eth) return;
    try {
      const hex: string = await eth.request({ method: "eth_chainId" });
      setChainId(parseInt(hex, 16));
    } catch {}
  }, [eth]);

  const readAccount = useCallback(async () => {
    if (!eth) return;
    try {
      const accounts: string[] = await eth.request({ method: "eth_accounts" });
      setAddress(accounts[0] ?? null);
    } catch {}
  }, [eth]);

  useEffect(() => {
    readAccount();
    readChain();
    if (!eth) return;
    const onAccounts = (accs: string[]) => setAddress(accs[0] ?? null);
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, [eth, readAccount, readChain]);

  const switchToBase = useCallback(async () => {
    if (!eth) return;
    setIsSwitching(true);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_HEX }] });
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await eth.request({ method: "wallet_addEthereumChain", params: [BASE_NETWORK] });
        } catch {}
      }
    } finally {
      setIsSwitching(false);
      await readChain();
    }
  }, [eth, readChain]);

  const connect = useCallback(async () => {
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(eth);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0] ?? null);
      await readChain();
    } catch {}
    finally {
      setIsConnecting(false);
    }
  }, [eth, readChain]);

  const isBase = chainId === BASE_CHAIN_ID;
  const truncated = address ? truncate(address) : null;

  return { address, truncated, chainId, isBase, isConnecting, isSwitching, hasMetaMask, connect, switchToBase };
}
