// ─────────────────────────────────────────────────────────────────────────────
// APOL NETWORK CONFIG — single source of truth for all chain/payment settings
// ─────────────────────────────────────────────────────────────────────────────

const NETWORKS = {
  sepolia: {
    id: 84532,
    hex: "0x14A34",
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  mainnet: {
    id: 8453,
    hex: "0x2105",
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
} as const;

// ── CHANGE THIS ONE LINE TO SWITCH THE ENTIRE SITE BETWEEN NETWORKS ──────────
const CURRENT_NETWORK: keyof typeof NETWORKS = "sepolia";
// ─────────────────────────────────────────────────────────────────────────────

/** Active network — all chain references pull from here. */
export const CHAIN = NETWORKS[CURRENT_NETWORK];

/** Payment configuration — wallet address + fees in ETH. */
export const PAYMENT = {
  platformWallet: "0x857aca6A8A743C9262d64819D239f509a1Cd0A85",
  deepDiveFee: "0.005",  // ETH — Deep Dive Scan
  verifyFee:   "0.05",   // ETH — Get Verified submission
} as const;

/**
 * Ensures the user's wallet is on CHAIN before a transaction.
 * If they're on the wrong network, prompts them to switch automatically.
 * Throws if they reject the switch request.
 */
export async function ensureCorrectNetwork(provider: any): Promise<void> {
  const currentHex: string = await provider.request({ method: "eth_chainId" });
  if (parseInt(currentHex, 16) === CHAIN.id) return; // already correct

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN.hex }],
    });
  } catch (err: any) {
    // 4902 = chain not yet added to wallet
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN.hex,
          chainName: CHAIN.name,
          nativeCurrency: CHAIN.nativeCurrency,
          rpcUrls: [CHAIN.rpcUrl],
          blockExplorerUrls: [CHAIN.explorerUrl],
        }],
      });
    } else {
      throw new Error(`Please switch your wallet to ${CHAIN.name} to continue.`);
    }
  }
}
